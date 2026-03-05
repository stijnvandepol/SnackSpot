import { type NextRequest } from 'next/server'
import { ModerationActionSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { ok, err, parseBody, requireRole, serverError, isResponse } from '@/lib/api-helpers'
import { ReviewStatus, PhotoModerationStatus, ReportStatus, ModerationActionType } from '@prisma/client'

export async function POST(req: NextRequest) {
  const auth = requireRole(req, 'MODERATOR')
  if (isResponse(auth)) return auth

  const body = await parseBody(req, ModerationActionSchema)
  if (isResponse(body)) return body

  try {
    switch (body.action) {
      case 'HIDE_REVIEW':
        await prisma.review.update({
          where: { id: body.targetId },
          data: { status: ReviewStatus.HIDDEN },
        })
        break

      case 'UNHIDE_REVIEW':
        await prisma.review.update({
          where: { id: body.targetId },
          data: { status: ReviewStatus.PUBLISHED },
        })
        break

      case 'DELETE_REVIEW':
        await prisma.review.update({
          where: { id: body.targetId },
          data: { status: ReviewStatus.DELETED },
        })
        break

      case 'DELETE_PHOTO':
        await prisma.photo.update({
          where: { id: body.targetId },
          data: { moderationStatus: PhotoModerationStatus.REJECTED },
        })
        break

      case 'BAN_USER':
        // Admins only may ban users
        if (auth.role !== 'ADMIN') return err('Only admins can ban users', 403)
        await prisma.user.update({
          where: { id: body.targetId },
          data: { bannedAt: new Date() },
        })
        break

      case 'UNBAN_USER':
        if (auth.role !== 'ADMIN') return err('Only admins can unban users', 403)
        await prisma.user.update({
          where: { id: body.targetId },
          data: { bannedAt: null },
        })
        break

      case 'DISMISS_REPORT':
        if (!body.reportId) return err('reportId required to dismiss a report', 422)
        await prisma.report.update({
          where: { id: body.reportId },
          data: { status: ReportStatus.DISMISSED },
        })
        break

      default:
        return err('Unknown action', 400)
    }

    // Resolve linked report if provided
    if (body.reportId && body.action !== 'DISMISS_REPORT') {
      await prisma.report.update({
        where: { id: body.reportId },
        data: { status: ReportStatus.RESOLVED },
      }).catch(() => undefined)
    }

    // Write audit log
    await prisma.moderationAction.create({
      data: {
        moderatorId: auth.sub,
        actionType: body.action as ModerationActionType,
        targetType: body.targetType,
        targetId: body.targetId,
        note: body.note,
      },
    })

    return ok({ action: body.action, targetId: body.targetId })
  } catch (e) {
    return serverError('mod/actions', e)
  }
}
