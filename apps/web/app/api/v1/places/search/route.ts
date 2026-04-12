import { type NextRequest } from 'next/server'
import { PlaceSearchSchema } from '@snackspot/shared'
import { ok, err, parseQuery, serverError, isResponse, withPublicCache } from '@/lib/api-helpers'
import { buildCacheKey, getCachedJson, setCachedJson, stableSearchParams } from '@/lib/cache'
import { getClientIP, rateLimitIP } from '@/lib/rate-limit'
import { type PlaceSearchResult, searchNearbyWithText, searchNearby, searchByText, searchPopular } from '@/lib/place-search'

export async function GET(req: NextRequest) {
  const query = parseQuery(req, PlaceSearchSchema)
  if (isResponse(query)) return query

  try {
    const ip = getClientIP(req)
    const rl = await rateLimitIP(ip, 'places_search', 120, 60)
    if (!rl.allowed) return err('Too many search requests - try again later', 429)

    const cacheKey = buildCacheKey('places-search', stableSearchParams(req.nextUrl.searchParams))
    const cached = await getCachedJson<PlaceSearchResult>(cacheKey)
    if (cached) return await withPublicCache(ok(cached), 15, 60)

    const isNearby = query.lat !== undefined && query.lng !== undefined
    const rows = isNearby && query.q
      ? await searchNearbyWithText(query.lat!, query.lng!, query.radius, query.q, query.limit)
      : isNearby
        ? await searchNearby(query.lat!, query.lng!, query.radius, query.limit)
        : query.q
          ? await searchByText(query.q, query.limit)
          : await searchPopular(query.limit)

    const ttl = isNearby ? 15 : 30
    const stale = isNearby ? 60 : 120
    const payload: PlaceSearchResult = { data: rows, pagination: { nextCursor: null, hasMore: false } }

    await setCachedJson(cacheKey, payload, ttl)
    return await withPublicCache(ok(payload), ttl, stale)
  } catch (e) {
    return serverError('places/search', e)
  }
}
