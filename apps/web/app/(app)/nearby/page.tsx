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

interface GeolocationErrorLike {
  code?: number
  message?: string
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

  if (lat === null || lng === null || !isValidLatitude(lat) || !isValidLongitude(lng)) {
    return null
  }

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

function getReadableGeolocationError(err: GeolocationErrorLike): string {
  if (err.code === 1) {
    return 'Location permission was denied. Enable location access for this site in your browser settings.'
  }

  if (err.code === 2) {
    return 'Your location is unavailable right now. Check OS location services and try again.'
  }

  if (err.code === 3) {
    return 'Location request timed out. Try again in an open area or with a better connection.'
  }

  return err.message ? `Location error: ${err.message}` : 'Could not determine your location.'
}

function getCurrentPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

export default function NearbyPage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [radius, setRadius] = useState(3000)
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)

  const search = useCallback(
    async (lat: number, lng: number, r: number) => {
      setLoading(true)
      setSearchError(null)
      try {
        const res = await fetch(`/api/v1/places/search?lat=${lat}&lng=${lng}&radius=${r}&limit=30`)
        if (!res.ok) throw new Error('Search failed')
        const json = await res.json()
        const rawPlaces: unknown[] = Array.isArray(json?.data?.data) ? json.data.data : []
        const normalizedPlaces = rawPlaces
          .map(normalizePlace)
          .filter((place: Place | null): place is Place => place !== null)

        if (normalizedPlaces.length !== rawPlaces.length) {
          console.warn('Dropped nearby places with invalid coordinates', {
            total: rawPlaces.length,
            dropped: rawPlaces.length - normalizedPlaces.length,
          })
        }

        setPlaces(normalizedPlaces)
      } catch (err) {
        console.error(err)
        setSearchError('Could not load nearby places. Try again.')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by your browser.')
      return
    }

    if (!window.isSecureContext) {
      setGeoError('Location only works on secure origins (HTTPS or localhost).')
      return
    }

    setGeoError(null)
    setLoading(true)

    const locate = async () => {
      try {
        if ('permissions' in navigator && navigator.permissions?.query) {
          try {
            const permission = await navigator.permissions.query({ name: 'geolocation' })
            if (permission.state === 'denied') {
              setGeoError('Location permission is blocked in your browser. Enable it and try again.')
              return
            }
          } catch {
            // Ignore Permissions API issues and continue with direct geolocation request.
          }
        }

        // Try multiple strategies because browsers/OSes differ across desktop and mobile.
        const attempts: PositionOptions[] = [
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 },
        ]

        let lastError: GeolocationErrorLike | null = null
        let foundPosition: GeolocationPosition | null = null

        for (const options of attempts) {
          try {
            foundPosition = await getCurrentPosition(options)
            break
          } catch (err) {
            const geoErr = err as GeolocationErrorLike
            lastError = geoErr
            if (geoErr.code === 1) break
          }
        }

        if (!foundPosition) {
          setGeoError(getReadableGeolocationError(lastError ?? {}))
          setLoading(false)
          return
        }

        const lat = toFiniteNumber(foundPosition.coords.latitude)
        const lng = toFiniteNumber(foundPosition.coords.longitude)

        if (lat === null || lng === null || !isValidLatitude(lat) || !isValidLongitude(lng)) {
          console.error('[Geolocation] Invalid coords from browser', foundPosition.coords.latitude, foundPosition.coords.longitude)
          setGeoError('Your browser returned an invalid location. Make sure Location Services are enabled in your OS and browser settings.')
          return
        }

        setPosition({ lat, lng })
        await search(lat, lng, radius)
        setGeoError(null)
      } catch (err) {
        const geoErr = err as GeolocationErrorLike
        console.error('[Geolocation error]', geoErr.code, geoErr.message)
        setGeoError(getReadableGeolocationError(geoErr))
      } finally {
        setLoading(false)
      }
    }

    void locate()
  }

  // Re-search when radius changes
  useEffect(() => {
    if (position) search(position.lat, position.lng, radius)
  }, [radius]) // eslint-disable-line

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-snack-text">Map View</h1>
        <p className="text-sm text-snack-muted">Discover snack locations around you and open each location page.</p>
      </div>

      {/* Controls */}
      <div className="card p-4 mb-6 space-y-4">
        {geoError && <p className="text-sm text-red-500">{geoError}</p>}
        <button onClick={useMyLocation} className="btn-primary w-full" disabled={loading}>
          {loading ? 'Searching…' : 'Use current location'}
        </button>

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
          <p className="text-snack-muted">Choose your location to discover nearby spots.</p>
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
