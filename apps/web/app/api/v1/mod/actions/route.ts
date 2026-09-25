import { type NextRequest } from 'next/server'
import { ModerationActionSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { ok, err, parseBody, requireRole, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'
import { photoObjectKeys, removeObjectsBestEffort } from '@/lib/storage-cleanup'
import { ReviewStatus, PhotoModerationStatus, ReportStatus, ModerationActionType } from '@prisma/client'

export async function POST(req: NextRequest) {
  const auth = requireRole(req, 'MODERATOR')
  if (isResponse(auth)) return auth

  // Rate limit: 200 moderation actions per hour per moderator
  const rl = await rateLimitUser(auth.sub, 'mod_action', 200, 3600)
  if (!rl.allowed) return err('Too many requests', 429)

  const body = await parseBody(req, ModerationActionSchema)
  if (isResponse(body)) return body

  try {
    let mutation
    switch (body.action) {
      case 'HIDE_REVIEW':
        mutation = prisma.review.update({
          where: { id: body.targetId },
          data: { status: ReviewStatus.HIDDEN },
        })
        break

      case 'UNHIDE_REVIEW':
        mutation = prisma.review.update({
          where: { id: body.targetId },
          data: { status: ReviewStatus.PUBLISHED, deletedAt: null, deletedById: null },
        })
        break

      case 'DELETE_REVIEW':
        // deletedById = the moderator: the owner cannot restore a takedown,
        // and the purge job still erases it after the 30-day window.
        mutation = prisma.review.update({
          where: { id: body.targetId },
          data: { status: ReviewStatus.DELETED, deletedAt: new Date(), deletedById: auth.sub },
        })
        break

      case 'DELETE_PHOTO':
        mutation = prisma.photo.update({
          where: { id: body.targetId },
          data: { moderationStatus: PhotoModerationStatus.REJECTED },
        })
        break

      case 'BAN_USER':
        // Admins only may ban users
        if (auth.role !== 'ADMIN') return err('Only admins can ban users', 403)
        mutation = prisma.user.update({
          where: { id: body.targetId },
          data: { bannedAt: new Date() },
        })
        break

      case 'UNBAN_USER':
        if (auth.role !== 'ADMIN') return err('Only admins can unban users', 403)
        mutation = prisma.user.update({
          where: { id: body.targetId },
          data: { bannedAt: null },
        })
        break

      case 'DISMISS_REPORT':
        if (!body.reportId) return err('reportId required to dismiss a report', 422)
        mutation = prisma.report.update({
          where: { id: body.reportId },
          data: { status: ReportStatus.DISMISSED },
        })
        break

      default:
        return err('Unknown action', 400)
    }

    // The mutation and its audit-log entry commit atomically: a moderation
    // action is never applied without being logged (and vice versa).
    await prisma.$transaction([
      mutation,
      prisma.moderationAction.create({
        data: {
          moderatorId: auth.sub,
          actionType: body.action as ModerationActionType,
          targetType: body.targetType,
          targetId: body.targetId,
          note: body.note,
        },
      }),
    ])

    // A rejected photo must stop being served, not just be flagged: the variant route
    // serves any key it is given, with a one-year immutable cache header. The public
    // variants go now; the private original stays for an appeal and the daily sweep.
    // (Edge caches still hold copies until purged — see GROWTH_PLAN.md.)
    if (body.action === 'DELETE_PHOTO') {
      const photo = await prisma.photo.findUnique({
        where: { id: body.targetId },
        select: { storageKey: true, variants: true },
      })
      if (photo) {
        const variantKeys = photoObjectKeys(photo).filter((key) => key !== photo.storageKey)
        await removeObjectsBestEffort(variantKeys, 'photo-rejected')
      }
    }

    // A ban takes effect at the next refresh at the latest: without live refresh tokens
    // the banned user is out once the current 15-minute access token expires.
    if (body.action === 'BAN_USER') {
      await prisma.refreshToken.deleteMany({ where: { userId: body.targetId } })
    }

    // Resolve linked report if provided — best-effort, the report may be gone.
    if (body.reportId && body.action !== 'DISMISS_REPORT') {
      await prisma.report.update({
        where: { id: body.reportId },
        data: { status: ReportStatus.RESOLVED },
      }).catch(() => undefined)
    }

    return ok({ action: body.action, targetId: body.targetId })
  } catch (e) {
    return serverError('mod/actions', e)
  }
}
