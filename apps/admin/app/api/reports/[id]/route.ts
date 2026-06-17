import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ModerationActionType } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { serverError, mapPrismaError, parseBody, isResponse } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

const VALID_REPORT_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'] as const
const VALID_REPORT_ACTIONS = ['HIDE_REVIEW', 'DELETE_REVIEW', 'DELETE_PHOTO', 'DISMISS'] as const

// Validate the enums at the boundary so downstream code can trust the shape —
// no runtime re-check and no `as ReportStatus` cast needed.
const UpdateReportBody = z.object({
  status: z.enum(VALID_REPORT_STATUSES).optional(),
  action: z.enum(VALID_REPORT_ACTIONS).optional(),
  targetId: z.string().optional(),
})

// GET /api/reports/[id] - Get report details
export async function GET(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin
  const { id } = await params

  try {
    const report = await db.report.findUnique({
      where: { id },
      select: {
        id: true,
        targetType: true,
        reason: true,
        status: true,
        createdAt: true,
        reporter: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        review: {
          select: {
            id: true,
            text: true,
            status: true,
            rating: true,
            ratingOverall: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
            place: {
              select: {
                id: true,
                name: true,
                address: true,
              },
            },
          },
        },
        photo: {
          select: {
            id: true,
            moderationStatus: true,
            uploaderId: true,
            createdAt: true,
          },
        },
      },
    })

    if (!report) {
      return NextResponse.json(
        { error: 'Report niet gevonden' },
        { status: 404 }
      )
    }

    return NextResponse.json({ report })
  } catch (e) {
    return serverError('report GET', e)
  }
}

// PATCH /api/reports/[id] - Update report status
export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin
  const { id } = await params

  const body = await parseBody(req, UpdateReportBody)
  if (isResponse(body)) return body
  const { status, action, targetId } = body

  try {
    // Update report status
    if (status) {
      const report = await db.report.update({
        where: { id: id },
        data: { status },
        select: {
          id: true,
          status: true,
        },
      })

      return NextResponse.json({ report })
    }

    // Perform moderation action
    if (action && targetId) {
      const report = await db.report.findUnique({
        where: { id: id },
        select: { targetType: true, reviewId: true, photoId: true },
      })

      if (!report) {
        return NextResponse.json(
          { error: 'Report niet gevonden' },
          { status: 404 }
        )
      }

      // The moderation action and its audit-log entry commit atomically, so a
      // report mutation is never applied without an accurate log (and vice versa).
      // HIDE and DELETE are distinct outcomes and are logged as what they are.
      const logAction = (actionType: ModerationActionType) =>
        db.moderationAction.create({
          data: {
            moderatorId: admin.sub,
            actionType,
            targetType: report.targetType,
            targetId,
          },
        })

      switch (action) {
        case 'HIDE_REVIEW':
          if (report.reviewId) {
            await db.$transaction([
              db.review.update({ where: { id: report.reviewId }, data: { status: 'HIDDEN' } }),
              db.report.update({ where: { id }, data: { status: 'RESOLVED' } }),
              logAction('HIDE_REVIEW'),
            ])
          }
          break

        case 'DELETE_REVIEW':
          if (report.reviewId) {
            await db.$transaction([
              db.review.update({ where: { id: report.reviewId }, data: { status: 'DELETED' } }),
              db.report.update({ where: { id }, data: { status: 'RESOLVED' } }),
              logAction('DELETE_REVIEW'),
            ])
          }
          break

        case 'DELETE_PHOTO':
          if (report.photoId) {
            await db.$transaction([
              db.photo.update({ where: { id: report.photoId }, data: { moderationStatus: 'REJECTED' } }),
              db.report.update({ where: { id }, data: { status: 'RESOLVED' } }),
              logAction('DELETE_PHOTO'),
            ])
          }
          break

        case 'DISMISS':
          await db.$transaction([
            db.report.update({ where: { id }, data: { status: 'DISMISSED' } }),
            logAction('DISMISS_REPORT'),
          ])
          break
      }

      return NextResponse.json({ success: true, action })
    }

    return NextResponse.json(
      { error: 'Ongeldige request' },
      { status: 400 }
    )
  } catch (error: unknown) {
    return (
      mapPrismaError(error, { notFound: 'Report niet gevonden' }) ??
      serverError('report PATCH', error)
    )
  }
}

// DELETE /api/reports/[id] - Delete report
export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin
  const { id } = await params

  try {
    await db.report.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return (
      mapPrismaError(error, { notFound: 'Report niet gevonden' }) ??
      serverError('report DELETE', error)
    )
  }
}
