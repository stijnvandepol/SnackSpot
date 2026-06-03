import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { err, parseBody, serverError, mapPrismaError, isResponse } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

const UpdateReviewBody = z.object({
  status: z.string().optional(),
  text: z.string().optional(),
  dishName: z.string().nullable().optional(),
})

// GET /api/reviews/[id] - Get review details
export async function GET(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin
  const { id } = await params

  try {
    const review = await db.review.findUnique({
      where: { id },
      select: {
        id: true,
        rating: true,
        ratingTaste: true,
        ratingValue: true,
        ratingPortion: true,
        ratingService: true,
        ratingOverall: true,
        text: true,
        dishName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
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
        _count: {
          select: {
            reviewLikes: true,
          },
        },
      },
    })

    if (!review) {
      return NextResponse.json(
        { error: 'Review niet gevonden' },
        { status: 404 }
      )
    }

    return NextResponse.json({ review })
  } catch (error: unknown) {
    return serverError('review GET', error)
  }
}

// PATCH /api/reviews/[id] - Update review status or content
export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin
  const { id } = await params

  const body = await parseBody(req, UpdateReviewBody)
  if (isResponse(body)) return body

  try {
    // Status update
    if (body.status !== undefined) {
      if (!['PUBLISHED', 'HIDDEN', 'DELETED'].includes(body.status)) {
        return err('Ongeldige status', 400)
      }
      const review = await db.review.update({
        where: { id },
        data: { status: body.status as 'PUBLISHED' | 'HIDDEN' | 'DELETED' },
        select: { id: true, status: true },
      })
      return NextResponse.json({ review })
    }

    // Content update
    if (body.text !== undefined || body.dishName !== undefined) {
      if (body.text !== undefined && body.text.trim() === '') {
        return err('Review tekst mag niet leeg zijn', 400)
      }
      const data: { text?: string; dishName?: string | null } = {}
      if (body.text !== undefined) data.text = body.text.trim()
      if (body.dishName !== undefined) data.dishName = typeof body.dishName === 'string' ? body.dishName || null : null

      const review = await db.review.update({
        where: { id },
        data,
        select: { id: true, text: true, dishName: true, updatedAt: true },
      })
      return NextResponse.json({ review })
    }

    return err('Geen geldige velden opgegeven', 400)
  } catch (error: unknown) {
    return mapPrismaError(error, { notFound: 'Review niet gevonden' }) ?? serverError('review PATCH', error)
  }
}

// DELETE /api/reviews/[id] - Delete review permanently
export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin
  const { id } = await params

  try {
    await db.review.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return mapPrismaError(error, { notFound: 'Review niet gevonden' }) ?? serverError('review DELETE', error)
  }
}
