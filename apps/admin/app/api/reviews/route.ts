import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseQuery, serverError, isResponse } from '@/lib/api-helpers'

const ListReviewsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().default(''),
  status: z.enum(['PUBLISHED', 'HIDDEN', 'DELETED']).optional(),
})

// GET /api/reviews - List all reviews
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin

  const query = parseQuery(req, ListReviewsQuery)
  if (isResponse(query)) return query
  const { page, limit, search, status } = query

  try {
    const where: Prisma.ReviewWhereInput = {}

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
  } catch (e) {
    return serverError('reviews GET', e)
  }
}
