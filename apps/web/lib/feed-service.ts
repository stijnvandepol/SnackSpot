import { ReviewStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { buildCacheKey, getCachedJson, setCachedJson } from '@/lib/cache'
import { reviewListSelect, serializeReview } from '@/lib/review-helpers'
import { logger } from '@/lib/logger'
// Type-only, so no client code is pulled into this server module. Sharing the shape
// keeps the seed and the component that consumes it from drifting apart.
import type { FeedSeed } from '@/components/feed-client'

export type { FeedSeed }

/**
 * Server-side first page of the public feed.
 *
 * Exists so the homepage and the explore page can ship their content in the HTML instead
 * of fetching it after hydration. Both were fully client-rendered, which meant a crawler
 * got an `<h1>` and nothing else on the site's most-shown page — and 55.65% of Google's
 * crawl budget was going to JavaScript against 23.60% to HTML (GSC crawl stats, Aug 2026).
 *
 * The cursor format and page shape match GET /api/v1/feed exactly, so the client component
 * can continue paginating from this seed without a special case.
 */

/** Matches the `limit` FeedClient requests, so the seed and page two line up. */
export const FEED_PAGE_SIZE = 15

/** Anonymous feed content changes slowly; this mirrors the API route's public cache. */
const FEED_CACHE_TTL_SECONDS = 60

const EMPTY_SEED: FeedSeed = { reviews: [], nextCursor: null, hasMore: true }

/**
 * The newest published reviews, serialized exactly as the API returns them.
 *
 * Always anonymous: `likedByMe` is false for every card, so a signed-in viewer's client
 * refetches once auth resolves. That keeps this cacheable across all visitors.
 *
 * Never throws. `next build` runs without a database (CI and both Dockerfiles supply a
 * placeholder DATABASE_URL), and a feed outage should degrade to the client fetch rather
 * than take down the homepage.
 */
export async function getPublicFeedSeed(limit: number = FEED_PAGE_SIZE): Promise<FeedSeed> {
  const cacheKey = buildCacheKey('feed-seed', String(limit))

  const cached = await getCachedJson<FeedSeed>(cacheKey)
  if (cached) return cached

  try {
    const rows = await prisma.review.findMany({
      where: { status: ReviewStatus.PUBLISHED },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: reviewListSelect(),
    })

    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    const last = items.at(-1)
    const nextCursor =
      hasMore && last ? encodeURIComponent(`${last.createdAt.toISOString()}|${last.id}`) : null

    const seed: FeedSeed = {
      // serializeReview is typed against a permissive raw row, so it widens to
      // Record<string, unknown>. The select above is reviewListSelect(), which produces
      // exactly the fields the feed card reads — same cast the place page makes.
      reviews: items.map((row) => ({
        ...serializeReview(row),
        createdAt: row.createdAt.toISOString(),
      })) as unknown as FeedSeed['reviews'],
      nextCursor,
      hasMore,
    }

    await setCachedJson(cacheKey, seed, FEED_CACHE_TTL_SECONDS)
    return seed
  } catch (error) {
    logger.error({ err: error }, 'Failed to build the server-rendered feed seed')
    return EMPTY_SEED
  }
}
