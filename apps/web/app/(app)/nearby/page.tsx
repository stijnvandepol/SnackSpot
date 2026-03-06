'use client'
import { useCallback, useEffect, useState } from 'react'
import { PlaceCard } from '@/components/place-card'
import { PlaceMap } from '@/components/place-map'

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
        setPlaces(json.data.data)
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
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setPosition({ lat, lng })
        search(lat, lng, radius)
        setGeoError(null)
      },
      (err) => {
        setGeoError(`Location error: ${err.message}`)
        setLoading(false)
      },
    )
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

        {geoError && <p className="text-sm text-red-500">{geoError}</p>}
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
