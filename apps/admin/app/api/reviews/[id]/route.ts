import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === code
}

// GET /api/reviews/[id] - Get review details
export async function GET(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin
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
    return NextResponse.json(
      { error: 'Error fetching review' },
      { status: 500 }
    )
  }
}

// PATCH /api/reviews/[id] - Update review status or content
export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin
  const { id } = await params

  try {
    const body = (await req.json()) as {
      status?: 'PUBLISHED' | 'HIDDEN' | 'DELETED'
      text?: string
      dishName?: string | null
    }

    // Status update
    if (body.status !== undefined) {
      if (!['PUBLISHED', 'HIDDEN', 'DELETED'].includes(body.status)) {
        return NextResponse.json({ error: 'Ongeldige status' }, { status: 400 })
      }
      const review = await db.review.update({
        where: { id },
        data: { status: body.status },
        select: { id: true, status: true },
      })
      return NextResponse.json({ review })
    }

    // Content update
    if (body.text !== undefined || body.dishName !== undefined) {
      if (body.text !== undefined && body.text.trim() === '') {
        return NextResponse.json({ error: 'Review tekst mag niet leeg zijn' }, { status: 400 })
      }
      const data: { text?: string; dishName?: string | null } = {}
      if (body.text !== undefined) data.text = body.text.trim()
      if (body.dishName !== undefined) data.dishName = body.dishName || null

      const review = await db.review.update({
        where: { id },
        data,
        select: { id: true, text: true, dishName: true, updatedAt: true },
      })
      return NextResponse.json({ review })
    }

    return NextResponse.json({ error: 'Geen geldige velden opgegeven' }, { status: 400 })
  } catch (error: unknown) {
    if (hasPrismaCode(error, 'P2025')) {
      return NextResponse.json({ error: 'Review niet gevonden' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Error updating review' }, { status: 500 })
  }
}

// DELETE /api/reviews/[id] - Delete review permanently
export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin
  const { id } = await params

  try {
    await db.review.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (hasPrismaCode(error, 'P2025')) {
      return NextResponse.json(
        { error: 'Review niet gevonden' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Error deleting review' },
      { status: 500 }
    )
  }
}
