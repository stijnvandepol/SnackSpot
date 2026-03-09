import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, parseQuery, requireAuth, serverError, isResponse, withNoStore } from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'

const MeReviewsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const query = parseQuery(req, MeReviewsQuerySchema)
  if (isResponse(query)) return query

  try {
    const reviews = await prisma.review.findMany({
      where: {
        userId: auth.sub,
        status: { not: ReviewStatus.DELETED },
        ...(query.cursor ? { createdAt: { lt: new Date(decodeURIComponent(query.cursor)) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit + 1,
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
        _count: { select: { reviewLikes: true } },
        reviewLikes: { where: { userId: auth.sub }, select: { userId: true }, take: 1 },
        user: { select: { id: true, username: true, avatarKey: true, role: true } },
        place: { select: { id: true, name: true, address: true } },
        reviewPhotos: {
          orderBy: { sortOrder: 'asc' },
          select: { photo: { select: { id: true, variants: true } } },
        },
      },
    })

    const hasMore = reviews.length > query.limit
    const items = hasMore ? reviews.slice(0, query.limit) : reviews
    const withLikes = items.map((item) => ({
      ...item,
      rating: Number(item.rating),
      likeCount: item._count.reviewLikes,
      likedByMe: item.reviewLikes.length > 0,
      ratings: {
        taste: Number(item.ratingTaste),
        value: Number(item.ratingValue),
        portion: Number(item.ratingPortion),
        service: item.ratingService === null ? null : Number(item.ratingService),
      },
      overallRating: Number(item.ratingOverall),
      _count: undefined,
      reviewLikes: undefined,
    }))
    const nextCursor = hasMore ? encodeURIComponent(items.at(-1)!.createdAt.toISOString()) : null

    return withNoStore(ok({ data: withLikes, pagination: { nextCursor, hasMore } }))
  } catch (e) {
    return serverError('me/reviews', e)
  }
}
