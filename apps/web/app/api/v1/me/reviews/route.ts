import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, parseQuery, requireAuth, serverError, isResponse, withNoStore } from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'
import { reviewListSelect, serializeReview } from '@/lib/review-helpers'

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
      select: reviewListSelect(auth.sub),
    })

    const hasMore = reviews.length > query.limit
    const items = hasMore ? reviews.slice(0, query.limit) : reviews
    const nextCursor = hasMore ? encodeURIComponent(items.at(-1)!.createdAt.toISOString()) : null

    return withNoStore(ok({ data: items.map(serializeReview), pagination: { nextCursor, hasMore } }))
  } catch (e) {
    return serverError('me/reviews', e)
  }
}
