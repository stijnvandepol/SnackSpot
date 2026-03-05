import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, err, parseQuery, serverError, isResponse, getAuthPayload } from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'

const UserReviewsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params
  const auth = getAuthPayload(req)
  const query = parseQuery(req, UserReviewsQuerySchema)
  if (isResponse(query)) return query

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    })
    if (!user) return err('User not found', 404)

    const reviews = await prisma.review.findMany({
      where: {
        userId: user.id,
        status: ReviewStatus.PUBLISHED,
        ...(query.cursor ? { createdAt: { lt: new Date(decodeURIComponent(query.cursor)) } } : {}),
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
        _count: { select: { reviewLikes: true } },
        reviewLikes: auth
          ? { where: { userId: auth.sub }, select: { userId: true }, take: 1 }
          : false,
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
      likeCount: item._count.reviewLikes,
      likedByMe: auth ? item.reviewLikes.length > 0 : false,
      _count: undefined,
      reviewLikes: undefined,
    }))
    const nextCursor = hasMore ? encodeURIComponent(items.at(-1)!.createdAt.toISOString()) : null

    return ok({ data: withLikes, pagination: { nextCursor, hasMore } })
  } catch (e) {
    return serverError('users/[username]/reviews', e)
  }
}
