import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: { id: string } }

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === code
}

const VALID_REPORT_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'] as const

// GET /api/reports/[id] - Get report details
export async function GET(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin

  try {
    const report = await db.report.findUnique({
      where: { id: params.id },
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
  } catch {
    return NextResponse.json(
      { error: 'Error fetching report' },
      { status: 500 }
    )
  }
}

// PATCH /api/reports/[id] - Update report status
export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin

  try {
    const { status, action, targetId } = (await req.json()) as {
      status?: 'OPEN' | 'RESOLVED' | 'DISMISSED'
      action?: 'HIDE_REVIEW' | 'DELETE_REVIEW' | 'DELETE_PHOTO' | 'DISMISS'
      targetId?: string
    }

    // Update report status
    if (status && (VALID_REPORT_STATUSES as readonly string[]).includes(status)) {
      const report = await db.report.update({
        where: { id: params.id },
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
        where: { id: params.id },
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
              where: { id: params.id },
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
              where: { id: params.id },
              data: { status: 'RESOLVED' },
            })
          }
          break

        case 'DISMISS':
          await db.report.update({
            where: { id: params.id },
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
          actionType,
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
    if (hasPrismaCode(error, 'P2025')) {
      return NextResponse.json(
        { error: 'Report niet gevonden' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Error updating report' },
      { status: 500 }
    )
  }
}

// DELETE /api/reports/[id] - Delete report
export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin

  try {
    await db.report.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (hasPrismaCode(error, 'P2025')) {
      return NextResponse.json(
        { error: 'Report niet gevonden' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Error deleting report' },
      { status: 500 }
    )
  }
}
