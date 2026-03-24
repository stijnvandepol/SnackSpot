'use client'
import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { PlaceCard } from '@/components/place-card'

const PlaceMap = dynamic(() => import('@/components/place-map').then((mod) => ({ default: mod.PlaceMap })), {
  ssr: false,
  loading: () => <div className="w-full h-96 bg-snack-surface rounded-xl animate-pulse border border-[#ececec] mb-6" />,
})

interface Place {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  avg_rating: number | null
  review_count: number
  distance_m: number
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim().length === 0) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90
}

function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180
}

function normalizePlace(raw: unknown): Place | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Record<string, unknown>
  const lat = toFiniteNumber(candidate.lat)
  const lng = toFiniteNumber(candidate.lng)
  if (lat === null || lng === null || !isValidLatitude(lat) || !isValidLongitude(lng)) return null
  return {
    id: typeof candidate.id === 'string' ? candidate.id : '',
    name: typeof candidate.name === 'string' ? candidate.name : 'Unknown place',
    address: typeof candidate.address === 'string' ? candidate.address : '',
    lat,
    lng,
    avg_rating: toFiniteNumber(candidate.avg_rating),
    review_count: toFiniteNumber(candidate.review_count) ?? 0,
    distance_m: toFiniteNumber(candidate.distance_m) ?? 0,
  }
}

// accuracy === 0 indicates the Windows ILatLongReport bug: success callback
// fired but OS returned uninitialized floats. Only used for mobile GPS path.
// See: https://bugzilla.mozilla.org/show_bug.cgi?id=1980653
function isUsablePosition(pos: GeolocationPosition): boolean {
  const { latitude, longitude, accuracy } = pos.coords
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    isValidLatitude(latitude) &&
    isValidLongitude(longitude) &&
    accuracy > 0
  )
}

export default function NearbyPage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [radius, setRadius] = useState(3000)
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  // Detected after mount — pointer:coarse = touch primary input = mobile/tablet
  const [isMobile, setIsMobile] = useState(false)
  const [addressQuery, setAddressQuery] = useState('')

  useEffect(() => {
    setIsMobile(window.matchMedia('(pointer: coarse)').matches)
  }, [])

  const search = useCallback(
    async (lat: number, lng: number, r: number) => {
      setLoading(true)
      setSearchError(null)
      try {
        const res = await fetch(`/api/v1/places/search?lat=${lat}&lng=${lng}&radius=${r}&limit=30`)
        if (!res.ok) throw new Error('Search failed')
        const json = await res.json()
        const rawPlaces: unknown[] = Array.isArray(json?.data?.data) ? json.data.data : []
        setPlaces(
          rawPlaces
            .map(normalizePlace)
            .filter((p: Place | null): p is Place => p !== null),
        )
      } catch (err) {
        console.error(err)
        setSearchError('Could not load nearby places. Try again.')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // ── Mobile: browser GPS geolocation ───────────────────────────────────────
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by your browser.')
      return
    }
    setGeoError(null)
    setLoading(true)

    const locate = async () => {
      try {
        if ('permissions' in navigator && navigator.permissions?.query) {
          try {
            const perm = await navigator.permissions.query({ name: 'geolocation' })
            if (perm.state === 'denied') {
              setGeoError('Location permission is blocked. Enable it in your browser site settings.')
              return
            }
          } catch { /* Permissions API not supported — continue */ }
        }

        const pos = await new Promise<GeolocationPosition | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve(isUsablePosition(p) ? p : null),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
          )
        })

        if (!pos) {
          setGeoError('Could not get your location. Make sure GPS is enabled.')
          return
        }

        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        await search(pos.coords.latitude, pos.coords.longitude, radius)
      } catch (err) {
        console.error('[Geolocation]', err)
        setGeoError('Could not get your location. Make sure GPS is enabled.')
      } finally {
        setLoading(false)
      }
    }

    void locate()
  }

  // ── Desktop: address lookup via Nominatim ─────────────────────────────────
  const useAddress = async () => {
    const query = addressQuery.trim()
    if (!query) {
      setGeoError('Enter a city or address first.')
      return
    }
    setGeoError(null)
    setLoading(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'nl,en' } },
      )
      if (!res.ok) throw new Error('Geocoding failed')
      const data = (await res.json()) as Array<{ lat: string; lon: string }>
      const first = data[0]
      const lat = toFiniteNumber(first?.lat)
      const lng = toFiniteNumber(first?.lon)
      if (lat === null || lng === null || !isValidLatitude(lat) || !isValidLongitude(lng)) {
        setGeoError('No location found. Try a more specific city or address.')
        return
      }
      setPosition({ lat, lng })
      await search(lat, lng, radius)
    } catch (err) {
      console.error('[Address lookup]', err)
      setGeoError('Address lookup failed. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // Re-search when radius changes
  useEffect(() => {
    if (position) search(position.lat, position.lng, radius)
  }, [radius]) // eslint-disable-line

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-snack-text">Nearby Food Spots</h1>
        <p className="text-sm text-snack-muted">Discover local snack bars, cafés, and hidden food gems around you on the map.</p>
      </div>

      {/* Controls */}
      <div className="card p-4 mb-6 space-y-4">
        {geoError && <p className="text-sm text-red-500">{geoError}</p>}

        {isMobile ? (
          // Mobile: one-tap GPS button
          <button onClick={useMyLocation} className="btn-primary w-full" disabled={loading}>
            {loading ? 'Searching…' : 'Use current location'}
          </button>
        ) : (
          // Desktop: address input — avoids the Windows geolocation NaN bug entirely
          <div className="flex gap-2">
            <input
              type="text"
              value={addressQuery}
              onChange={(e: { target: { value: string } }) => setAddressQuery(e.target.value)}
              onKeyDown={(e: { key: string }) => { if (e.key === 'Enter') void useAddress() }}
              placeholder="Enter city or address…"
              className="input flex-1"
              disabled={loading}
            />
            <button
              type="button"
              className="btn-primary whitespace-nowrap"
              onClick={() => void useAddress()}
              disabled={loading || addressQuery.trim().length === 0}
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        )}

        <div>
          <label className="label">
            Radius: <span className="font-semibold text-snack-primary">{radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}</span>
          </label>
          <div className="mb-2 flex flex-wrap gap-2">
            {[1000, 3000, 5000, 10000].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadius(r)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${radius === r ? 'bg-snack-primary text-white' : 'bg-snack-surface text-snack-muted'}`}
              >
                {r >= 1000 ? `${r / 1000} km` : `${r} m`}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={200}
            max={20000}
            step={200}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full accent-[var(--snack-primary)]"
            aria-label="Search radius"
          />
          <div className="flex justify-between text-xs text-snack-muted mt-1">
            <span>200 m</span><span>20 km</span>
          </div>
        </div>

        {searchError && <p className="text-sm text-red-500">{searchError}</p>}

        {position && (
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => search(position.lat, position.lng, radius)}
            disabled={loading}
          >
            Search this area again
          </button>
        )}
      </div>

      {/* Map */}
      {position && <PlaceMap position={position} places={places} radius={radius} />}

      {/* Results */}
      {!position && !loading && (
        <div className="text-center py-16">
          <p className="text-snack-muted">
            {isMobile ? 'Tap the button above to find snack spots near you.' : 'Enter your city or address above to find nearby spots.'}
          </p>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-20 animate-pulse bg-snack-surface" />
          ))}
        </div>
      )}

      {!loading && position && places.length === 0 && (
        <div className="text-center py-16">
          <p className="text-snack-muted">No spots found within {radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}.</p>
          <p className="text-sm text-snack-muted mt-1">Try increasing the radius.</p>
        </div>
      )}

      <div className="space-y-3">
        {places.map((p) => (
          <PlaceCard
            key={p.id}
            place={{
              id: p.id,
              name: p.name,
              address: p.address,
              avgRating: p.avg_rating,
              reviewCount: p.review_count,
              distance: p.distance_m,
            }}
            from="nearby"
          />
        ))}
      </div>
    </div>
  )
}
