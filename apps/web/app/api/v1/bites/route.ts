import { type NextRequest } from 'next/server'
import { CreateBiteSchema } from '@snackspot/shared'
import { PhotoModerationStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { created, err, parseBody, requireAuth, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'
import { awardXp, XP_DAILY_EVENT_CAPS } from '@/lib/xp-service'
import { bumpQuestProgress } from '@/lib/quest-service'
import { getProgressSnapshot } from '@/lib/user-stats'
import { logger } from '@/lib/logger'

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Today's calendar date (YYYY-MM-DD) in the given IANA timezone. */
function localDateInZone(tz: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
}

// POST /api/v1/bites — log a meal photo. Auth required.
// Response: { data: { bite, xp, streak } }
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const body = await parseBody(req, CreateBiteSchema)
  if (isResponse(body)) return body

  if (!isValidTimeZone(body.timezone)) {
    return err('Ongeldige tijdzone.', 422)
  }

  try {
    const rl = await rateLimitUser(auth.sub, 'bite_create', 30, 3600)
    if (!rl.allowed) return err('Te veel bites achter elkaar. Probeer het later opnieuw.', 429)

    const photo = await prisma.photo.findUnique({
      where: { id: body.photoId },
      select: {
        id: true,
        uploaderId: true,
        moderationStatus: true,
        _count: { select: { reviewPhotos: true } },
      },
    })
    if (!photo || photo.uploaderId !== auth.sub) return err('Foto niet gevonden.', 404)
    if (photo.moderationStatus === PhotoModerationStatus.PENDING) {
      return err('De foto wordt nog geüpload. Wacht even en probeer het opnieuw.', 422)
    }
    if (photo.moderationStatus === PhotoModerationStatus.REJECTED) {
      return err('Deze foto is afgekeurd. Kies een andere foto.', 422)
    }
    if (photo._count.reviewPhotos > 0) {
      return err('Deze foto hoort al bij een review.', 409)
    }

    if (body.placeId) {
      const place = await prisma.place.findUnique({ where: { id: body.placeId }, select: { id: true } })
      if (!place) return err('Snackplek niet gevonden.', 404)
    }

    const localDate = new Date(`${localDateInZone(body.timezone)}T00:00:00.000Z`)

    // Count before insert so the daily XP cap is deterministic.
    const bitesToday = await prisma.bite.count({
      where: { userId: auth.sub, localDate },
    })

    const bite = await prisma.$transaction(async (tx) => {
      const row = await tx.bite.create({
        data: {
          userId: auth.sub,
          photoId: body.photoId,
          placeId: body.placeId ?? null,
          mealSlot: body.mealSlot,
          note: body.note?.trim() ? body.note.trim() : null,
          visibility: body.visibility,
          localDate,
        },
        select: {
          id: true,
          mealSlot: true,
          note: true,
          visibility: true,
          localDate: true,
          createdAt: true,
          photo: { select: { id: true, variants: true } },
          place: { select: { id: true, name: true } },
        },
      })
      await tx.userStats.upsert({
        where: { userId: auth.sub },
        create: { userId: auth.sub, bitesCount: 1 },
        update: { bitesCount: { increment: 1 } },
      })
      // Remember the client's timezone for future meal-timed notifications.
      await tx.user.update({ where: { id: auth.sub }, data: { timezone: body.timezone } })
      return row
    })

    const biteCap = XP_DAILY_EVENT_CAPS.BITE_LOGGED ?? Infinity
    const award =
      bitesToday < biteCap
        ? await awardXp({ userId: auth.sub, reason: 'BITE_LOGGED', refType: 'bite', refId: bite.id })
        : null

    // Quest progress before the snapshot so quest XP is reflected in the totals.
    await bumpQuestProgress(auth.sub, 'BITES_LOGGED')
    if (body.placeId) await bumpQuestProgress(auth.sub, 'PLACE_BITES_LOGGED')

    const snapshot = await getProgressSnapshot(auth.sub)

    return created({
      bite: { ...bite, localDate: bite.localDate.toISOString().slice(0, 10) },
      xp: { awarded: award?.awarded ?? 0, leveledUp: award?.leveledUp ?? false, ...snapshot.xp },
      streak: snapshot.streak,
    })
  } catch (e: unknown) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === 'P2002') {
      return err('Deze foto is al gebruikt voor een bite.', 409)
    }
    logger.error({ err: e, userId: auth.sub }, 'bite create failed')
    return serverError('bites POST', e)
  }
}
