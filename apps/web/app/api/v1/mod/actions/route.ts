import { type NextRequest } from 'next/server'
import { ModerationActionSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { ok, err, parseBody, requireRole, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'
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
