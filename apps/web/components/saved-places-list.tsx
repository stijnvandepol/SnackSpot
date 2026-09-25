'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import type { FavoritePlace } from '@/lib/favorite-service'

/** Private "Bewaard" list on the profile: places someone wants to try or return to. */
export function SavedPlacesList() {
  const { accessToken } = useAuth()
  const [places, setPlaces] = useState<FavoritePlace[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    fetch('/api/v1/me/favorites?limit=100', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => {
        if (!cancelled) setPlaces(json.data?.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  if (error)
    return (
      <p role="alert" className="py-8 text-center text-sm text-red-600">
        Je bewaarde zaken konden niet worden geladen.
      </p>
    )

  if (places === null) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card h-20 animate-pulse bg-snack-surface" />
        ))}
      </div>
    )
  }

  if (places.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="font-semibold text-snack-text">Nog niets bewaard</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-snack-muted">
          Zie je een zaak die je wilt proberen? Tik op <span aria-hidden="true">☆</span> Bewaren, dan staat hij hier
          klaar voor later.
        </p>
        <Link href="/search" className="btn-primary mt-4 inline-block">
          Zaken ontdekken
        </Link>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {places.map((place) => (
        <li key={place.id}>
          <Link
            href={`/place/${place.id}?from=profile`}
            className="card flex items-center gap-3 p-3 transition hover:border-snack-primary/40"
          >
            {place.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP variant
              <img
                src={place.photoUrl}
                alt=""
                width={64}
                height={64}
                loading="lazy"
                decoding="async"
                className="h-16 w-16 flex-shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-snack-surface text-xl"
              >
                🍟
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-snack-text">{place.name}</p>
              <p className="truncate text-xs text-snack-muted">{place.city ?? place.address}</p>
              <p className="mt-0.5 text-xs text-snack-muted">
                {place.avgRating !== null ? `★ ${place.avgRating.toFixed(1)} · ` : ''}
                {place.reviewCount === 1 ? '1 review' : `${place.reviewCount} reviews`}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
