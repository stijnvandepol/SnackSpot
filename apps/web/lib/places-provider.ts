import { logger } from '@/lib/logger'

// ─── Provider-agnostic place verification ────────────────────────────────────
// A place a user can attach a review to must be a *verified* real-world venue,
// not free text. Providers return canonical venue data keyed by a stable id, so
// re-selecting the same venue always resolves to the same place row.
//
// The default implementation is OpenStreetMap (Nominatim): free, no API key,
// already allowed in our CSP. Swapping to Google Places / Mapbox means
// implementing this same interface in one file and pointing `placesProvider`
// at it — nothing else in the app changes.

export interface ProviderPlace {
  /** Identifies the source, stored on places.provider. */
  provider: string
  /** Stable provider id, stored on places.provider_place_id. */
  providerPlaceId: string
  /** Canonical venue name (what we store — never the user's free text). */
  name: string
  /** Human-readable address line. */
  address: string
  lat: number
  lng: number
  /** Optional city/cuisine hints the provider can supply. */
  city: string | null
}

export interface PlacesProvider {
  readonly id: string
  /** Autocomplete/search for venues matching a query, optionally near a point. */
  search(query: string, opts?: { lat?: number; lng?: number; limit?: number }): Promise<ProviderPlace[]>
  /** Re-fetch a single venue by its provider id (used to verify at write time). */
  lookup(providerPlaceId: string): Promise<ProviderPlace | null>
}

// ─── OpenStreetMap / Nominatim ───────────────────────────────────────────────

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const USER_AGENT = 'SnackSpot/1.0 (contact@snackspot.online)'
// Food/drink venue categories worth reviewing — filters out generic addresses.
const FOOD_CATEGORIES = new Set([
  'restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'food_court', 'ice_cream',
  'bakery', 'deli', 'confectionery', 'coffee', 'tea',
])

interface NominatimResult {
  osm_type?: string
  osm_id?: number
  lat?: string
  lon?: string
  name?: string
  display_name?: string
  category?: string
  type?: string
  address?: Record<string, string>
}

function isFoodVenue(r: NominatimResult): boolean {
  if (r.category === 'amenity' || r.category === 'shop') {
    return FOOD_CATEGORIES.has(r.type ?? '')
  }
  return Boolean(r.name) // named POIs without a clear category are allowed if they have a name
}

function toProviderPlace(r: NominatimResult): ProviderPlace | null {
  if (!r.osm_type || r.osm_id === undefined || !r.lat || !r.lon) return null
  const name = r.name?.trim() || r.display_name?.split(',')[0]?.trim()
  if (!name) return null

  const addr = r.address ?? {}
  const street = [addr.road, addr.house_number].filter(Boolean).join(' ')
  const city = addr.city || addr.town || addr.village || addr.municipality || null
  const addressLine = [street, city].filter(Boolean).join(', ') || r.display_name || ''

  // osm_type is 'node'|'way'|'relation' → prefix keeps ids unique across types.
  const providerPlaceId = `${r.osm_type[0].toUpperCase()}${r.osm_id}`

  return {
    provider: 'osm',
    providerPlaceId,
    name,
    address: addressLine,
    lat: Number(r.lat),
    lng: Number(r.lon),
    city,
  }
}

async function nominatimFetch(path: string): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(`${NOMINATIM_BASE}${path}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Nominatim ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timeout)
  }
}

const osmProvider: PlacesProvider = {
  id: 'osm',

  async search(query, opts) {
    const limit = Math.min(opts?.limit ?? 8, 15)
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      namedetails: '0',
      limit: String(limit),
    })
    // Bias toward the user's location with a viewbox when we have coordinates.
    if (opts?.lat !== undefined && opts?.lng !== undefined) {
      const d = 0.15 // ~15km box
      params.set('viewbox', `${opts.lng - d},${opts.lat - d},${opts.lng + d},${opts.lat + d}`)
      params.set('bounded', '0')
    }
    try {
      const raw = (await nominatimFetch(`/search?${params}`)) as NominatimResult[]
      return raw
        .filter(isFoodVenue)
        .map(toProviderPlace)
        .filter((p): p is ProviderPlace => p !== null)
    } catch (err) {
      logger.error({ err, query }, 'Place provider search failed')
      return []
    }
  },

  async lookup(providerPlaceId) {
    // providerPlaceId is like 'N123' / 'W123' / 'R123'.
    const typeChar = providerPlaceId[0]?.toLowerCase()
    const osmType = typeChar === 'n' ? 'N' : typeChar === 'w' ? 'W' : typeChar === 'r' ? 'R' : null
    const osmId = providerPlaceId.slice(1)
    if (!osmType || !/^\d+$/.test(osmId)) return null

    const params = new URLSearchParams({
      osm_ids: `${osmType}${osmId}`,
      format: 'jsonv2',
      addressdetails: '1',
    })
    try {
      const raw = (await nominatimFetch(`/lookup?${params}`)) as NominatimResult[]
      const first = raw[0]
      return first ? toProviderPlace(first) : null
    } catch (err) {
      logger.error({ err, providerPlaceId }, 'Place provider lookup failed')
      return null
    }
  },
}

/** The active provider. Swap this assignment to change providers app-wide. */
export const placesProvider: PlacesProvider = osmProvider
