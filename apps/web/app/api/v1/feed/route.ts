import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, parseQuery, serverError, isResponse } from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'

const FeedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export async function GET(req: NextRequest) {
  const query = parseQuery(req, FeedQuerySchema)
  if (isResponse(query)) return query

  try {
    const reviews = await prisma.review.findMany({
      where: {
        status: ReviewStatus.PUBLISHED,
        ...(query.cursor
          ? { createdAt: { lt: new Date(decodeURIComponent(query.cursor)) } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit + 1,
      select: {
        id: true,
        rating: true,
        text: true,
        dishName: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, username: true, avatarKey: true, role: true } },
        place: { select: { id: true, name: true, address: true } },
        reviewPhotos: {
          take: 5,
          orderBy: { sortOrder: 'asc' },
          select: {
            photo: { select: { id: true, variants: true } },
          },
        },
      },
    })

    const hasMore = reviews.length > query.limit
    const items = hasMore ? reviews.slice(0, query.limit) : reviews
    const nextCursor = hasMore ? encodeURIComponent(items.at(-1)!.createdAt.toISOString()) : null

    return ok({ data: items, pagination: { nextCursor, hasMore } })
  } catch (e) {
    return serverError('feed', e)
  }
}
