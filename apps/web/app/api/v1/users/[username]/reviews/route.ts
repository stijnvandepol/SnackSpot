import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, err, parseQuery, serverError, isResponse, getAuthPayload, withNoStore, withPublicCache } from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'
import { reviewListSelect, serializeReview } from '@/lib/review-helpers'

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
    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
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
      select: reviewListSelect(auth?.sub),
    })

    const hasMore = reviews.length > query.limit
    const items = hasMore ? reviews.slice(0, query.limit) : reviews
    const nextCursor = hasMore ? encodeURIComponent(items.at(-1)!.createdAt.toISOString()) : null

    const res = ok({ data: items.map(serializeReview), pagination: { nextCursor, hasMore } })
    return auth ? withNoStore(res) : await withPublicCache(res, 15, 60)
  } catch (e) {
    return serverError('users/[username]/reviews', e)
  }
}
