'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { Map, MapMarker, MarkerContent, MarkerPopup, MapControls, useMap } from '@/components/ui/map'

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

interface PlaceMapProps {
  position: { lat: number; lng: number }
  places: Place[]
  radius: number
}

function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90
}

function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180
}

function hasValidCoordinates(point: { lat: number; lng: number }): boolean {
  return isValidLatitude(point.lat) && isValidLongitude(point.lng)
}

function FitBounds({ position, places }: { position: { lat: number; lng: number }; places: Place[] }) {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return

    const allPoints = [
      [position.lng, position.lat] as [number, number],
      ...places.map((p) => [p.lng, p.lat] as [number, number]),
    ]

    if (allPoints.length === 1) {
      map.flyTo({ center: allPoints[0], zoom: 14, duration: 800 })
      return
    }

    const lngs = allPoints.map((p) => p[0])
    const lats = allPoints.map((p) => p[1])
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ]

    map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 800 })
  }, [map, isLoaded, places, position])

  return null
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

function formatRating(rating: number | null): string {
  if (!rating) return 'No rating'
  return `${rating.toFixed(1)} ★`
}

export function PlaceMap({ position, places, radius }: PlaceMapProps) {
  if (!hasValidCoordinates(position)) {
    console.warn('Skipping nearby map render because the current position is invalid', position)
    return null
  }

  const validPlaces = places.filter(hasValidCoordinates)

  if (validPlaces.length !== places.length) {
    console.warn('Skipping nearby map markers with invalid coordinates', {
      total: places.length,
      skipped: places.length - validPlaces.length,
    })
  }

  return (
    <div className="w-full rounded-xl overflow-hidden border border-[#ececec] mb-6 shadow-sm" style={{ height: '420px' }}>
      <Map
        theme="light"
        center={[position.lng, position.lat]}
        zoom={13}
      >
        {/* User location marker */}
        <MapMarker longitude={position.lng} latitude={position.lat}>
          <MarkerContent>
            <div className="relative flex items-center justify-center">
              <div className="h-5 w-5 rounded-full bg-[#0042DB] border-2 border-white shadow-lg" />
              <div className="absolute h-5 w-5 rounded-full bg-[#0042DB] opacity-30 animate-ping" />
            </div>
          </MarkerContent>
          <MarkerPopup closeButton>
            <p className="font-semibold text-sm">Your location</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Search radius: {radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}
            </p>
          </MarkerPopup>
        </MapMarker>

        {/* Place markers */}
        {validPlaces.map((place) => (
          <MapMarker key={place.id} longitude={place.lng} latitude={place.lat}>
            <MarkerContent>
              <svg width="28" height="38" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 0C8.27 0 2 6.27 2 14c0 9 14 25 14 25s14-16 14-25c0-7.73-6.27-14-14-14Z" fill="#FF712F" stroke="white" strokeWidth="2"/>
                <circle cx="16" cy="14" r="5" fill="white"/>
              </svg>
            </MarkerContent>
            <MarkerPopup closeButton>
              <div className="min-w-[180px]">
                <p className="font-semibold text-sm">{place.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{place.address}</p>
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Distance</span>
                    <span className="font-medium text-[#FF712F]">{formatDistance(place.distance_m)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Rating</span>
                    <span className="font-medium">{formatRating(place.avg_rating)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Reviews</span>
                    <span className="font-medium">{place.review_count}</span>
                  </div>
                </div>
                <Link
                  href={`/place/${place.id}?from=nearby`}
                  className="mt-2 block text-center text-xs text-white rounded px-2 py-1 hover:opacity-90 transition"
                  style={{ backgroundColor: '#FF712F' }}
                >
                  View details
                </Link>
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}

        <FitBounds position={position} places={validPlaces} />
        <MapControls showZoom showCompass position="top-right" />
      </Map>
    </div>
  )
}
