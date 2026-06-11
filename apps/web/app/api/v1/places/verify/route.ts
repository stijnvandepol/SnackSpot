import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, err, parseQuery, requireAuth, serverError, isResponse } from '@/lib/api-helpers'
import { getClientIP, rateLimitIP, rateLimit } from '@/lib/rate-limit'
import { buildCacheKey, getCachedJson, setCachedJson } from '@/lib/cache'
import { placesProvider, type ProviderPlace } from '@/lib/places-provider'

// Cache provider results per normalized query + coarse geo bucket. This both
// speeds up repeat/popular queries and shields the external provider (and its
// usage policy) from our aggregate request volume.
const PROVIDER_CACHE_TTL = 600 // 10 minutes
function providerCacheKey(q: string, lat?: number, lng?: number): string {
  const geo = lat !== undefined && lng !== undefined
    ? `${lat.toFixed(2)}:${lng.toFixed(2)}` // ~1km bucket
    : 'global'
  return buildCacheKey('places-verify', `${q.trim().toLowerCase()}|${geo}`)
}

const VerifyQuery = z.object({
  q: z.string().trim().min(2).max(120),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
})

// GET /api/v1/places/verify?q=...  — autocomplete of verified venues.
// Returns existing SnackSpot places first (with id), then provider matches the
// user can pick to create a verified place. Auth-gated to keep the external
// provider from being used as an open proxy.
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const query = parseQuery(req, VerifyQuery)
  if (isResponse(query)) return query

  try {
    const rl = await rateLimitIP(getClientIP(req), 'places_verify', 30, 60)
    if (!rl.allowed) return err('Too many search requests - slow down a moment', 429)

    // Serve identical recent queries from cache; only a cache miss touches the
    // external provider.
    const cacheKey = providerCacheKey(query.q, query.lat, query.lng)
    let providerResults = await getCachedJson<ProviderPlace[]>(cacheKey)

    if (providerResults === null) {
      // Global throttle protecting the external provider's usage policy from
      // our aggregate volume (independent of the per-IP limit above).
      const globalGate = await rateLimit('rl:places-provider:global', 60, 60)
      if (!globalGate.allowed) return err('Search is busy right now - try again in a moment', 503)

      providerResults = await placesProvider.search(query.q, {
        lat: query.lat,
        lng: query.lng,
        limit: 8,
      })
      await setCachedJson(cacheKey, providerResults, PROVIDER_CACHE_TTL)
    }

    // Map provider ids we already have to their existing place rows, so picking
    // a known venue reuses it instead of looking "new".
    const providerIds = providerResults.map((p) => p.providerPlaceId)
    const known = providerIds.length
      ? await prisma.place.findMany({
          where: { provider: placesProvider.id, providerPlaceId: { in: providerIds } },
          select: { id: true, providerPlaceId: true },
        })
      : []
    const knownByProviderId = new Map(known.map((k) => [k.providerPlaceId, k.id]))

    const results = providerResults.map((p) => ({
      placeId: knownByProviderId.get(p.providerPlaceId) ?? null,
      provider: p.provider,
      providerPlaceId: p.providerPlaceId,
      name: p.name,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
    }))

    return ok({ data: results })
  } catch (e) {
    return serverError('places/verify', e)
  }
}
