import { type NextRequest } from 'next/server'
import { ReviewsQuerySchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { ok, parseQuery, serverError, isResponse, getAuthPayload, withNoStore, withPublicCache } from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: placeId } = await params
  const auth = getAuthPayload(req)
  const query = parseQuery(req, ReviewsQuerySchema)
  if (isResponse(query)) return query

  try {
    const isTop = query.sort === 'top'
    const whereClause = {
      placeId,
      status: ReviewStatus.PUBLISHED,
      ...(query.q
        ? {
            OR: [
              { text: { contains: query.q, mode: 'insensitive' as const } },
              { dishName: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(!isTop && query.cursor
        ? { createdAt: { lt: new Date(decodeURIComponent(query.cursor)) } }
        : {}),
    }

    const reviews = await prisma.review.findMany({
      where: whereClause,
      orderBy: isTop ? { rating: 'desc' } : { createdAt: 'desc' },
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
        tags: {
          orderBy: { tag: 'asc' },
          select: { tag: true },
        },
        _count: { select: { reviewLikes: true } },
        reviewLikes: {
          where: { userId: auth?.sub ?? '__no_user__' },
          select: { userId: true },
          take: 1,
        },
        user: { select: { id: true, username: true, avatarKey: true, role: true } },
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
      tags: item.tags.map((tag) => tag.tag),
      _count: undefined,
      reviewLikes: undefined,
    }))
    const nextCursor = !isTop && hasMore
      ? encodeURIComponent(items.at(-1)!.createdAt.toISOString())
      : null

    const res = ok({ data: withLikes, pagination: { nextCursor, hasMore } })
    return auth ? withNoStore(res) : withPublicCache(res, 15, 60)
  } catch (e) {
    return serverError('places/[id]/reviews', e)
  }
}
