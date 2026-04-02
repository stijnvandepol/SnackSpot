'use client'

import dynamic from 'next/dynamic'

const Map = dynamic(() => import('@/components/ui/map').then((m) => m.Map), {
  ssr: false,
  loading: () => <div className="h-48 rounded-xl bg-snack-surface animate-pulse" />,
})

const MapMarker = dynamic(() => import('@/components/ui/map').then((m) => m.MapMarker), {
  ssr: false,
})

const MarkerContent = dynamic(() => import('@/components/ui/map').then((m) => m.MarkerContent), {
  ssr: false,
})

interface PlaceMapEmbedProps {
  lat: number
  lng: number
  className?: string
}

export function PlaceMapEmbed({ lat, lng, className }: PlaceMapEmbedProps) {
  return (
    <Map viewport={{ center: [lng, lat], zoom: 14 }} className={className}>
      <MapMarker longitude={lng} latitude={lat}>
        <MarkerContent />
      </MapMarker>
    </Map>
  )
}
