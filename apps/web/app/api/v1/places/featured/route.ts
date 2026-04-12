import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, err, parseQuery, serverError, isResponse, withPublicCache } from '@/lib/api-helpers'
import { buildCacheKey, getCachedJson, setCachedJson, stableSearchParams } from '@/lib/cache'
import { getClientIP, rateLimitIP } from '@/lib/rate-limit'

type FeaturedPlaceRow = {
  id: string
  name: string
  address: string
  avg_rating: number | null
  review_count: number
  latest_review_at: Date
}

const FeaturedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(8),
})

export async function GET(req: NextRequest) {
  const query = parseQuery(req, FeaturedQuerySchema)
  if (isResponse(query)) return query

  try {
    const ip = getClientIP(req)
    const rl = await rateLimitIP(ip, 'places_featured', 120, 60)
    if (!rl.allowed) return err('Too many requests - try again later', 429)

    const cacheKey = buildCacheKey('places-featured', stableSearchParams(req.nextUrl.searchParams))
    const cached = await getCachedJson<{ data: FeaturedPlaceRow[] }>(cacheKey)
    if (cached) {
      return await withPublicCache(ok(cached), 30, 120)
    }

    const rows = await prisma.$queryRaw<FeaturedPlaceRow[]>`
      SELECT
        p.id,
        p.name,
        p.address,
        ROUND(AVG(r.rating_overall)::numeric, 1)::float AS avg_rating,
        COUNT(r.id)::int AS review_count,
        MAX(r.created_at) AS latest_review_at
      FROM places p
      JOIN reviews r ON r.place_id = p.id AND r.status = 'PUBLISHED'
      GROUP BY p.id, p.name, p.address
      ORDER BY latest_review_at DESC
      LIMIT ${query.limit}
    `

    const payload = { data: rows }
    await setCachedJson(cacheKey, payload, 30)
    return await withPublicCache(ok(payload), 30, 120)
  } catch (e) {
    return serverError('places/featured', e)
  }
}
