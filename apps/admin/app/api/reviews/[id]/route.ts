import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: { id: string } }

// GET /api/reviews/[id] - Get review details
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get('authorization')
    await requireAdmin(authHeader)

    const review = await db.review.findUnique({
      where: { id: params.id },
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error fetching review' },
      { status: 500 }
    )
  }
}

// PATCH /api/reviews/[id] - Update review status
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get('authorization')
    await requireAdmin(authHeader)

    const { status } = (await req.json()) as { status: 'PUBLISHED' | 'HIDDEN' | 'DELETED' }

    if (!['PUBLISHED', 'HIDDEN', 'DELETED'].includes(status)) {
      return NextResponse.json(
        { error: 'Ongeldige status' },
        { status: 400 }
      )
    }

    const review = await db.review.update({
      where: { id: params.id },
      data: { status },
      select: {
        id: true,
        status: true,
      },
    })

    return NextResponse.json({ review })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Review niet gevonden' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Error updating review' },
      { status: 500 }
    )
  }
}

// DELETE /api/reviews/[id] - Delete review permanently
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get('authorization')
    await requireAdmin(authHeader)

    await db.review.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Review niet gevonden' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Error deleting review' },
      { status: 500 }
    )
  }
}
