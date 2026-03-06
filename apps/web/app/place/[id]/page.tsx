'use client'
import { useEffect, useState } from 'react'
import { use } from 'react'
import { useSearchParams } from 'next/navigation'
import { ReviewCard } from '@/components/review-card'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'

interface Place { id: string; name: string; address: string; lat: number; lng: number; avg_rating: number | null; review_count: number }
interface Review {
  id: string; rating: number; text: string; dishName?: string | null; createdAt: string; status: string
  likeCount?: number; likedByMe?: boolean
  user: { id: string; username: string; avatarKey?: string | null; role: string }
  reviewPhotos: Array<{ photo: { id: string; variants: Record<string, string> } }>
}

export default function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const { accessToken } = useAuth()
  const [place, setPlace] = useState<Place | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [sort, setSort] = useState<'new' | 'top'>('new')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewsError, setReviewsError] = useState<string | null>(null)
  const from = searchParams.get('from')

  const backHref = (() => {
    if (!from) return '/search'
    if (from === 'search') return '/search'
    if (from === 'nearby') return '/nearby'
    if (from === 'feed') return '/feed'
    if (from === 'profile') return '/profile'
    if (from.startsWith('user:')) {
      const username = from.slice('user:'.length)
      return username ? `/u/${encodeURIComponent(username)}` : '/search'
    }
    return '/search'
  })()

  useEffect(() => {
    fetch(`/api/v1/places/${id}`)
      .then((r) => r.json())
      .then((json) => json.data ? setPlace(json.data) : setError('Place not found'))
      .catch(() => setError('Failed to load place'))
  }, [id])

  useEffect(() => {
    if (!place) return
    setLoading(true)
    setReviewsError(null)
    fetch(`/api/v1/places/${id}/reviews?sort=${sort}&limit=20`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
      .then((r) => r.json())
      .then((json) => setReviews(json.data?.data ?? []))
      .catch(() => setReviewsError('Could not load reviews for this place.'))
      .finally(() => setLoading(false))
  }, [place, sort, id, accessToken])

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-semibold text-snack-text">{error}</p>
        <Link href="/feed" className="btn-primary mt-4 inline-block">Back to Feed</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={backHref} className="btn-secondary text-sm">← Back</Link>
        {place && (
          <Link href={`/add-review?placeId=${place.id}`} className="btn-primary text-sm">
            + Write Review
          </Link>
        )}
      </div>

      {!place ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-gray-200 rounded-xl w-2/3" />
          <div className="h-5 bg-snack-surface rounded-xl w-1/2" />
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-heading font-bold text-snack-text">{place.name}</h1>
            <p className="text-sm text-snack-muted mt-1">{place.address}</p>

            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {place.avg_rating !== null && (
                <div className="flex items-center gap-1.5">
                  <span className="text-snack-rating">{'★'.repeat(Math.round(place.avg_rating ?? 0))}</span>
                  <span className="font-semibold text-snack-text">{place.avg_rating?.toFixed(1)}</span>
                </div>
              )}
              <span className="text-sm text-snack-muted">{place.review_count} {place.review_count === 1 ? 'review' : 'reviews'}</span>
              <a
                href={`https://www.google.com/maps?q=${place.lat},${place.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-snack-primary hover:underline"
                aria-label={`Open ${place.name} in maps`}
              >
                Open in maps
              </a>
            </div>
          </div>

          {reviewsError && (
            <div className="card p-3 mb-4 border-red-200 bg-red-50/50" role="status" aria-live="polite">
              <p className="text-sm text-red-700">{reviewsError}</p>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-snack-text">Reviews</h2>
            <div className="flex gap-1">
              {(['new', 'top'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${sort === s ? 'bg-snack-primary text-white' : 'bg-snack-surface text-snack-muted hover:opacity-90'}`}
                >
                  {s === 'new' ? 'Newest' : 'Top'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => <div key={i} className="card h-32 animate-pulse bg-snack-surface" />)}
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-snack-muted text-sm">No reviews yet. Be the first!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <ReviewCard
                  key={r.id}
                  review={{ ...r, place: { id: place.id, name: place.name, address: place.address } }}
                  showPlace={false}
                  backContext={`place:${place.id}:${encodeURIComponent(from ?? 'search')}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
