import { type NextRequest } from 'next/server'
import { ReviewsQuerySchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { ok, err, parseQuery, serverError, isResponse, getAuthPayload, withNoStore, withPublicCache } from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'
import { buildCacheKey, getCachedJson, setCachedJson, stableSearchParams } from '@/lib/cache'
import { getClientIP, rateLimitIP } from '@/lib/rate-limit'
import { reviewListSelect, serializeReview } from '@/lib/review-helpers'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: placeId } = await params
  const auth = getAuthPayload(req)
  const query = parseQuery(req, ReviewsQuerySchema)
  if (isResponse(query)) return query

  try {
    if (!auth) {
      const ip = getClientIP(req)
      const rl = await rateLimitIP(ip, 'place_reviews_public', 120, 60)
      if (!rl.allowed) return err('Too many requests - try again later', 429)

      const cacheKey = buildCacheKey(
        'place-reviews-public',
        `${placeId}:${stableSearchParams(req.nextUrl.searchParams)}`,
      )
      const cached = await getCachedJson<{
        data: Array<Record<string, unknown>>
        pagination: { nextCursor: string | null; hasMore: boolean }
      }>(cacheKey)
      if (cached) {
        return await withPublicCache(ok(cached), 15, 60)
      }
    }

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
      select: reviewListSelect(auth?.sub),
    })

    const hasMore = reviews.length > query.limit
    const items = hasMore ? reviews.slice(0, query.limit) : reviews
    const nextCursor = !isTop && hasMore
      ? encodeURIComponent(items.at(-1)!.createdAt.toISOString())
      : null

    const payload = { data: items.map(serializeReview), pagination: { nextCursor, hasMore } }

    if (!auth) {
      const cacheKey = buildCacheKey(
        'place-reviews-public',
        `${placeId}:${stableSearchParams(req.nextUrl.searchParams)}`,
      )
      await setCachedJson(cacheKey, payload, 15)
    }

    const res = ok(payload)
    return auth ? withNoStore(res) : await withPublicCache(res, 15, 60)
  } catch (e) {
    return serverError('places/[id]/reviews', e)
  }
}
