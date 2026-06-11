import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, err, parseQuery, requireAuth, serverError, isResponse } from '@/lib/api-helpers'
import { getClientIP, rateLimitIP } from '@/lib/rate-limit'
import { placesProvider } from '@/lib/places-provider'

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

    const providerResults = await placesProvider.search(query.q, {
      lat: query.lat,
      lng: query.lng,
      limit: 8,
    })

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
