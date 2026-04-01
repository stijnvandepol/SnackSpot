import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

// GET /api/reviews - List all reviews
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin

  try {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || String(DEFAULT_PAGE))
    const limit = Math.min(parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT)), MAX_LIMIT)
    const search = url.searchParams.get('search') || ''
    const status = url.searchParams.get('status') || ''

    const where: Prisma.ReviewWhereInput = {}
    
    if (search) {
      where.OR = [
        { text: { contains: search, mode: 'insensitive' as const } },
        { user: { username: { contains: search, mode: 'insensitive' as const } } },
        { place: { name: { contains: search, mode: 'insensitive' as const } } },
      ]
    }

    if (status) {
      where.status = status as Prisma.ReviewWhereInput['status']
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
  } catch {
    return NextResponse.json(
      { error: 'Error fetching reviews' },
      { status: 500 }
    )
  }
}
