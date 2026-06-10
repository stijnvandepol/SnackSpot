import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, err, parseQuery, serverError, isResponse, getAuthPayload, withNoStore, withPublicCache } from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'
import { buildCacheKey, getCachedJson, setCachedJson, stableSearchParams } from '@/lib/cache'
import { getClientIP, rateLimitIP } from '@/lib/rate-limit'
import { reviewListSelect, serializeReview } from '@/lib/review-helpers'

const FeedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  scope: z.enum(['discover', 'following']).default('discover'),
})

function parseCursor(cursorRaw?: string): { createdAt: Date; id: string | null } | null {
  if (!cursorRaw) return null

  try {
    const decoded = decodeURIComponent(cursorRaw)
    const [ts, id] = decoded.split('|')
    const createdAt = new Date(ts)
    if (Number.isNaN(createdAt.getTime())) return null
    return { createdAt, id: id || null }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const auth = getAuthPayload(req)
  const query = parseQuery(req, FeedQuerySchema)
  if (isResponse(query)) return query

  try {
    if (query.scope === 'following' && !auth) {
      return err('Authentication required for the following feed', 401)
    }

    if (!auth) {
      const ip = getClientIP(req)
      const rl = await rateLimitIP(ip, 'feed_public', 120, 60)
      if (!rl.allowed) return err('Too many feed requests - try again later', 429)

      const cacheKey = buildCacheKey('feed-public', stableSearchParams(req.nextUrl.searchParams))
      const cached = await getCachedJson<{
        data: Array<Record<string, unknown>>
        pagination: { nextCursor: string | null; hasMore: boolean }
      }>(cacheKey)
      if (cached) {
        return await withPublicCache(ok(cached), 60, 120)
      }
    }

    const cursor = parseCursor(query.cursor)

    // Following scope: only reviews from people the user follows (pull model;
    // fan-out is unnecessary at this scale).
    let followedUserIds: string[] | null = null
    if (query.scope === 'following' && auth) {
      const follows = await prisma.follow.findMany({
        where: { followerId: auth.sub },
        select: { followeeId: true },
      })
      followedUserIds = follows.map((f) => f.followeeId)
      if (followedUserIds.length === 0) {
        return withNoStore(ok({ data: [], pagination: { nextCursor: null, hasMore: false } }))
      }
    }

    const reviews = await prisma.review.findMany({
      where: {
        status: ReviewStatus.PUBLISHED,
        ...(followedUserIds ? { userId: { in: followedUserIds } } : {}),
        ...(cursor
          ? cursor.id
            ? {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              }
            : { createdAt: { lt: cursor.createdAt } }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: reviewListSelect(auth?.sub),
    })

    const hasMore = reviews.length > query.limit
    const items = hasMore ? reviews.slice(0, query.limit) : reviews
    const nextCursor = hasMore
      ? encodeURIComponent(`${items.at(-1)!.createdAt.toISOString()}|${items.at(-1)!.id}`)
      : null

    const payload = { data: items.map(serializeReview), pagination: { nextCursor, hasMore } }

    if (!auth) {
      const cacheKey = buildCacheKey('feed-public', stableSearchParams(req.nextUrl.searchParams))
      await setCachedJson(cacheKey, payload, 60)
    }

    const res = ok(payload)
    return auth ? withNoStore(res) : await withPublicCache(res, 60, 120)
  } catch (e) {
    return serverError('feed', e)
  }
}
