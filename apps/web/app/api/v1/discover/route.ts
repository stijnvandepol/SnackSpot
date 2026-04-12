import { type NextRequest } from 'next/server'
import { Prisma, ReviewStatus } from '@prisma/client'
import { ReviewTagSchema } from '@snackspot/shared'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  err,
  getAuthPayload,
  isResponse,
  ok,
  parseQuery,
  serverError,
  withNoStore,
  withPublicCache,
} from '@/lib/api-helpers'
import { buildCacheKey, getCachedJson, setCachedJson, stableSearchParams } from '@/lib/cache'
import { getClientIP, rateLimitIP } from '@/lib/rate-limit'
import { reviewListSelect, serializeReview } from '@/lib/review-helpers'

const DiscoverQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).default(4),
  tag: ReviewTagSchema.optional(),
})

async function getReviewsByIds(ids: string[], authSub?: string) {
  if (ids.length === 0) return []

  const reviews = await prisma.review.findMany({
    where: { id: { in: ids } },
    select: reviewListSelect(authSub),
  })

  const byId = new Map(reviews.map((review) => [review.id, serializeReview(review)]))
  return ids.map((id) => byId.get(id)).filter(Boolean)
}

export async function GET(req: NextRequest) {
  const auth = getAuthPayload(req)
  const query = parseQuery(req, DiscoverQuerySchema)
  if (isResponse(query)) return query

  try {
    if (!auth) {
      const ip = getClientIP(req)
      const rl = await rateLimitIP(ip, 'discover_public', 90, 60)
      if (!rl.allowed) return err('Too many discover requests - try again later', 429)

      const cacheKey = buildCacheKey('discover-public', stableSearchParams(req.nextUrl.searchParams))
      const cached = await getCachedJson<{
        freshFinds: Array<Record<string, unknown>>
        underTheRadar: Array<Record<string, unknown>>
      }>(cacheKey)
      if (cached) {
        return await withPublicCache(ok(cached), 20, 60)
      }
    }

    const tagFilter = query.tag
      ? {
          tags: {
            some: {
              tag: query.tag,
            },
          },
        }
      : {}

    const freshFinds = await prisma.review.findMany({
      where: {
        status: ReviewStatus.PUBLISHED,
        ...tagFilter,
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      select: reviewListSelect(auth?.sub),
    })

    const underTheRadarRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT r.id
      FROM reviews r
      JOIN (
        SELECT place_id, COUNT(*)::int AS review_count
        FROM reviews
        WHERE status = 'PUBLISHED'
        GROUP BY place_id
      ) place_counts ON place_counts.place_id = r.place_id
      WHERE r.status = 'PUBLISHED'
      ${query.tag
        ? Prisma.sql`AND EXISTS (
            SELECT 1
            FROM review_tags rt
            WHERE rt.review_id = r.id
              AND rt.tag = ${query.tag}
          )`
        : Prisma.empty}
      ORDER BY place_counts.review_count ASC, r.created_at DESC
      LIMIT ${query.limit * 3}
    `)

    const freshFindIds = new Set(freshFinds.map((review) => review.id))
    const underTheRadarIds = underTheRadarRows
      .map((row) => row.id)
      .filter((id) => !freshFindIds.has(id))
      .slice(0, query.limit)

    const underTheRadar = await getReviewsByIds(underTheRadarIds, auth?.sub)

    const payload = {
      freshFinds: freshFinds.map(serializeReview),
      underTheRadar,
    }

    if (!auth) {
      const cacheKey = buildCacheKey('discover-public', stableSearchParams(req.nextUrl.searchParams))
      await setCachedJson(cacheKey, payload, 20)
    }

    const res = ok(payload)

    return auth ? withNoStore(res) : await withPublicCache(res, 20, 60)
  } catch (e) {
    return serverError('discover', e)
  }
}
