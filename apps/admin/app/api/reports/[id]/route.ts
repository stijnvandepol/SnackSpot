import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ReportStatus, ModerationActionType } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { serverError, mapPrismaError, parseBody, isResponse } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

const VALID_REPORT_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'] as const

const UpdateReportBody = z.object({
  status: z.string().optional(),
  action: z.string().optional(),
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
    if (status && (VALID_REPORT_STATUSES as readonly string[]).includes(status)) {
      const report = await db.report.update({
        where: { id: id },
        // Runtime-validated against VALID_REPORT_STATUSES above; cast restores the
        // enum typing the original inline body type provided.
        data: { status: status as ReportStatus },
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

      // Execute the action based on type
      switch (action) {
        case 'DELETE_REVIEW':
        case 'HIDE_REVIEW':
          if (report.reviewId) {
            await db.review.update({
              where: { id: report.reviewId },
              data: { status: 'DELETED' },
            })
            await db.report.update({
              where: { id: id },
              data: { status: 'RESOLVED' },
            })
          }
          break

        case 'DELETE_PHOTO':
          if (report.photoId) {
            await db.photo.update({
              where: { id: report.photoId },
              data: { moderationStatus: 'REJECTED' },
            })
            await db.report.update({
              where: { id: id },
              data: { status: 'RESOLVED' },
            })
          }
          break

        case 'DISMISS':
          await db.report.update({
            where: { id: id },
            data: { status: 'DISMISSED' },
          })
          break
      }

      // Log the moderation action
      const actionType =
        action === 'DISMISS'
          ? 'DISMISS_REPORT'
          : action === 'HIDE_REVIEW'
            ? 'DELETE_REVIEW'
            : action

      await db.moderationAction.create({
        data: {
          moderatorId: admin.sub,
          actionType: actionType as ModerationActionType,
          targetType: report.targetType,
          targetId: targetId,
        },
      })

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
