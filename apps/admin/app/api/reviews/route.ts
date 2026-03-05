import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/reviews - List all reviews
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    await requireAdmin(authHeader)

    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const search = url.searchParams.get('search') || ''
    const status = url.searchParams.get('status') || ''

    const where: any = {}
    
    if (search) {
      where.OR = [
        { text: { contains: search, mode: 'insensitive' as const } },
        { user: { username: { contains: search, mode: 'insensitive' as const } } },
        { place: { name: { contains: search, mode: 'insensitive' as const } } },
      ]
    }

    if (status) {
      where.status = status
    }

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          ratingOverall: true,
          text: true,
          status: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              username: true,
            },
          },
          place: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              reviewLikes: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.review.count({ where }),
    ])

    return NextResponse.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error fetching reviews' },
      { status: 500 }
    )
  }
}
