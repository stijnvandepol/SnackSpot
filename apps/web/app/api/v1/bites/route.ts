import { type NextRequest } from 'next/server'
import { CreateBiteSchema } from '@snackspot/shared'
import { PhotoModerationStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { created, err, parseBody, requireAuth, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'
import { awardXp, XP_DAILY_EVENT_CAPS } from '@/lib/xp-service'
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
    return err('Invalid timezone', 422)
  }

  try {
    const rl = await rateLimitUser(auth.sub, 'bite_create', 30, 3600)
    if (!rl.allowed) return err('Bite rate limit exceeded', 429)

    const photo = await prisma.photo.findUnique({
      where: { id: body.photoId },
      select: {
        id: true,
        uploaderId: true,
        moderationStatus: true,
        _count: { select: { reviewPhotos: true } },
      },
    })
    if (!photo || photo.uploaderId !== auth.sub) return err('Photo not found', 404)
    if (photo.moderationStatus === PhotoModerationStatus.PENDING) {
      return err('Photo upload is not confirmed yet', 422)
    }
    if (photo.moderationStatus === PhotoModerationStatus.REJECTED) {
      return err('Photo was rejected', 422)
    }
    if (photo._count.reviewPhotos > 0) {
      return err('Photo is already attached to a review', 409)
    }

    if (body.placeId) {
      const place = await prisma.place.findUnique({ where: { id: body.placeId }, select: { id: true } })
      if (!place) return err('Place not found', 404)
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

    const snapshot = await getProgressSnapshot(auth.sub)

    return created({
      bite: { ...bite, localDate: bite.localDate.toISOString().slice(0, 10) },
      xp: { awarded: award?.awarded ?? 0, leveledUp: award?.leveledUp ?? false, ...snapshot.xp },
      streak: snapshot.streak,
    })
  } catch (e: unknown) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === 'P2002') {
      return err('Photo is already used for a bite', 409)
    }
    logger.error({ err: e, userId: auth.sub }, 'bite create failed')
    return serverError('bites POST', e)
  }
}
