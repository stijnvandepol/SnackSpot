'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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
  position: { lat: number; lng: number } | null
  places: Place[]
  radius: number
}

// Custom SVG icons
const getUserIcon = () =>
  L.divIcon({
    html: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
             <circle cx="16" cy="16" r="14" fill="#0042DB" stroke="white" stroke-width="2"/>
             <circle cx="16" cy="16" r="6" fill="white"/>
           </svg>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: 'user-marker',
  })

const getPlaceIcon = () =>
  L.divIcon({
    html: `<svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M16 0C8.27 0 2 6.27 2 14c0 9 14 25 14 25s14-16 14-25c0-7.73-6.27-14-14-14Z" fill="#FF712F" stroke="white" stroke-width="2"/>
             <circle cx="16" cy="14" r="5" fill="white"/>
           </svg>`,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    className: 'place-marker',
  })

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}

function formatRating(rating: number | null): string {
  if (!rating) return 'No rating'
  return `${rating.toFixed(1)} ★`
}

export function PlaceMap({ position, places, radius }: PlaceMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])

  useEffect(() => {
    if (!position) return

    try {
      // Initialize map
      if (!mapRef.current) {
        mapRef.current = L.map('map').setView([position.lat, position.lng], 13)

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(mapRef.current)
      } else {
        // Update map center
        mapRef.current.setView([position.lat, position.lng], 13)
      }

      // Clear previous markers
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []

      // Add user location marker
      const userMarker = L.marker([position.lat, position.lng], { icon: getUserIcon() }).addTo(mapRef.current)
      userMarker.bindPopup(`
        <div class="text-sm">
          <p class="font-semibold">Your location</p>
          <p class="text-xs text-gray-600 mt-1">Search radius: ${radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}</p>
        </div>
      `)
      markersRef.current.push(userMarker)

      // Add place markers
      places.forEach((place) => {
        const placeMarker = L.marker([place.lat, place.lng], { icon: getPlaceIcon() }).addTo(mapRef.current!)

        const popupContent = `
          <div class="text-sm min-w-[200px]">
            <p class="font-semibold text-snack-text">${place.name}</p>
            <p class="text-xs text-snack-muted mt-0.5">${place.address}</p>
            <div class="mt-2 pt-2 border-t border-[#ececec] space-y-1">
              <div class="flex justify-between">
                <span class="text-xs text-snack-muted">Distance:</span>
                <span class="text-xs font-medium text-snack-primary">${formatDistance(place.distance_m)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-xs text-snack-muted">Rating:</span>
                <span class="text-xs font-medium">${formatRating(place.avg_rating)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-xs text-snack-muted">Reviews:</span>
                <span class="text-xs font-medium">${place.review_count}</span>
              </div>
            </div>
            <a href="/place/${place.id}?from=nearby" class="mt-2 block text-center text-xs bg-snack-primary text-white rounded px-2 py-1 hover:opacity-90 transition" style="background-color: #FF712F;">
              View details
            </a>
          </div>
        `

        placeMarker.bindPopup(popupContent)
        markersRef.current.push(placeMarker)
      })
    } catch (error) {
      console.error('Failed to initialize map:', error)
    }
  }, [position, places, radius])

  if (!position) {
    return (
      <div className="w-full h-96 bg-snack-surface rounded-xl flex items-center justify-center border border-[#ececec] mb-6">
        <p className="text-snack-muted text-center">Enable location access to see the map</p>
      </div>
    )
  }

  return (
    <div className="w-full rounded-xl overflow-hidden border border-[#ececec] mb-6 shadow-sm">
      <div id="map" style={{ height: '400px', width: '100%' }} />
    </div>
  )
}
