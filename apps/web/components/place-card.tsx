import Link from 'next/link'
import { extractCity } from '@/lib/utils'

interface PlaceCardProps {
  place: {
    id: string
    name: string
    address: string
    avgRating?: number | null
    reviewCount?: number
    distance?: number
  }
  from?: string
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export function PlaceCard({ place, from }: PlaceCardProps) {
  const href = from
    ? `/place/${place.id}?from=${encodeURIComponent(from)}`
    : `/place/${place.id}`

  return (
    <Link href={href} aria-label={`Open place ${place.name}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snack-primary focus-visible:ring-offset-2">
      <article className="card p-4 transition hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-snack-text truncate">
              {place.name}
              {extractCity(place.address) && (
                <span className="font-normal text-snack-muted"> · {extractCity(place.address)}</span>
              )}
            </h3>
            <p className="text-xs text-snack-muted truncate mt-0.5">{place.address}</p>
          </div>
          {place.distance !== undefined && (
            <span className="flex-shrink-0 text-xs font-medium text-snack-primary bg-snack-surface px-2 py-1 rounded-full">
              {formatDistance(place.distance)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-3">
          {place.avgRating !== null && place.avgRating !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-snack-rating text-sm">{'★'.repeat(Math.round(place.avgRating))}</span>
              <span className="text-sm font-medium text-snack-text">{place.avgRating.toFixed(1)}</span>
            </div>
          )}
          {place.reviewCount !== undefined && (
            <span className="text-xs text-snack-muted">
              {place.reviewCount} {place.reviewCount === 1 ? 'review' : 'reviews'}
            </span>
          )}
        </div>
      </article>
    </Link>
  )
}
