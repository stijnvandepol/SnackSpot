'use client'

import dynamic from 'next/dynamic'

const Map = dynamic(() => import('@/components/ui/map').then((m) => m.Map), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-xl bg-snack-surface animate-pulse" />,
})

const MapMarker = dynamic(() => import('@/components/ui/map').then((m) => m.MapMarker), {
  ssr: false,
})

const MarkerContent = dynamic(() => import('@/components/ui/map').then((m) => m.MarkerContent), {
  ssr: false,
})

const MapControls = dynamic(() => import('@/components/ui/map').then((m) => m.MapControls), {
  ssr: false,
})

interface PlaceMapEmbedProps {
  lat: number
  lng: number
  className?: string
}

export function PlaceMapEmbed({ lat, lng, className }: PlaceMapEmbedProps) {
  return (
    <Map viewport={{ center: [lng, lat], zoom: 15 }} className={className}>
      <MapMarker longitude={lng} latitude={lat}>
        <MarkerContent>
          <svg width="28" height="38" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C8.27 0 2 6.27 2 14c0 9 14 25 14 25s14-16 14-25c0-7.73-6.27-14-14-14Z" fill="#FF712F" stroke="white" strokeWidth="2"/>
            <circle cx="16" cy="14" r="5" fill="white"/>
          </svg>
        </MarkerContent>
      </MapMarker>
      <MapControls showZoom showCompass position="top-right" />
    </Map>
  )
}
