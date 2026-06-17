import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, err, parseQuery, requireAuth, serverError, isResponse } from '@/lib/api-helpers'
import { getClientIP, rateLimitIP, rateLimit } from '@/lib/rate-limit'
import { buildCacheKey, getCachedJson, setCachedJson } from '@/lib/cache'
import { placesProvider, type ProviderPlace } from '@/lib/places-provider'
import { searchDbPlaces, nearbyDbPlaces } from '@/lib/place-service'

// Radius for the "places near you" shortcut (empty query + coordinates).
const NEARBY_RADIUS_METRES = 2000

/** Normalize a name for duplicate matching (diacritics + punctuation insensitive). */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

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
  // q may be empty in "nearby" mode (coords present, no search term).
  q: z.string().trim().max(120).optional().default(''),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
})

interface VerifyResult {
  placeId: string | null
  provider: string
  providerPlaceId: string | null
  name: string
  address: string
  lat: number
  lng: number
  reviewCount: number
}

// GET /api/v1/places/verify?q=...  — autocomplete of verified venues.
//
// Existing SnackSpot places (any provider, including community/manual entries)
// are searched first and shown on top, so a venue someone already reviewed is
// always reused instead of being recreated as a "new" duplicate. Provider
// (OpenStreetMap) matches are appended for venues not yet in our database.
// Auth-gated to keep the external provider from being used as an open proxy.
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const query = parseQuery(req, VerifyQuery)
  if (isResponse(query)) return query

  try {
    const rl = await rateLimitIP(getClientIP(req), 'places_verify', 30, 60)
    if (!rl.allowed) return err('Too many search requests - slow down a moment', 429)

    const coords = query.lat !== undefined && query.lng !== undefined
      ? { lat: query.lat, lng: query.lng }
      : null
    const term = query.q.trim()

    // Nearby mode: no search term but a location → show existing SnackSpot
    // places near the user so they can reuse one with a single tap. (The
    // provider has no clean "POIs near me" without a term, so this surfaces our
    // own verified venues.)
    if (term.length < 2) {
      if (!coords) return ok([])
      const near = await nearbyDbPlaces(coords, NEARBY_RADIUS_METRES, 10)
      return ok(
        near.map((p) => ({
          placeId: p.placeId,
          provider: p.provider,
          providerPlaceId: p.providerPlaceId,
          name: p.name,
          address: p.address,
          lat: p.lat,
          lng: p.lng,
          reviewCount: p.reviewCount,
        })),
      )
    }

    // 1. Existing SnackSpot places first (the dedup fix): match by name, nearest
    //    or most-reviewed first.
    const dbPlaces = await searchDbPlaces(term, coords, 8)
    const dbResults: VerifyResult[] = dbPlaces.map((p) => ({
      placeId: p.placeId,
      provider: p.provider,
      providerPlaceId: p.providerPlaceId,
      name: p.name,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      reviewCount: p.reviewCount,
    }))

    // What we already have, so we can skip provider duplicates.
    const knownProviderIds = new Set(
      dbPlaces.map((p) => p.providerPlaceId).filter((id): id is string => id !== null),
    )
    const knownNames = new Set(dbPlaces.map((p) => normalizeName(p.name)))

    // 2. Provider results (cached + globally throttled), appended for venues we
    //    don't have yet.
    const cacheKey = providerCacheKey(term, query.lat, query.lng)
    let providerResults = await getCachedJson<ProviderPlace[]>(cacheKey)
    if (providerResults === null) {
      const globalGate = await rateLimit('rl:places-provider:global', 60, 60)
      if (globalGate.allowed) {
        providerResults = await placesProvider.search(term, {
          lat: query.lat,
          lng: query.lng,
          limit: 8,
        })
        await setCachedJson(cacheKey, providerResults, PROVIDER_CACHE_TTL)
      } else {
        providerResults = [] // provider busy: still return DB results
      }
    }

    const providerOnly: VerifyResult[] = providerResults
      .filter(
        (p) =>
          !knownProviderIds.has(p.providerPlaceId) && !knownNames.has(normalizeName(p.name)),
      )
      .map((p) => ({
        placeId: null,
        provider: p.provider,
        providerPlaceId: p.providerPlaceId,
        name: p.name,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        reviewCount: 0,
      }))

    return ok([...dbResults, ...providerOnly])
  } catch (e) {
    return serverError('places/verify', e)
  }
}
