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
  overallRating?: number
  ratings?: { taste: number; value: number; portion: number; service?: number | null }
  tags?: string[]
  likeCount?: number; commentCount?: number; likedByMe?: boolean
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
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href={backHref} className="btn-secondary text-sm">Back</Link>
        {place && (
          <Link href={`/add-review?placeId=${place.id}`} className="btn-primary text-sm">
            Write review
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
          <div className="card mb-6 p-5">
            <h1 className="text-2xl font-heading font-bold text-snack-text">{place.name}</h1>
            <p className="mt-1 text-sm text-snack-muted">{place.address}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-snack-surface px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">Rating</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-snack-rating">{place.avg_rating !== null ? '★'.repeat(Math.max(1, Math.round(place.avg_rating ?? 0))) : '—'}</span>
                  <span className="font-semibold text-snack-text">{place.avg_rating?.toFixed(1) ?? 'No rating yet'}</span>
                </div>
              </div>
              <div className="rounded-xl bg-snack-surface px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">Reviews</p>
                <p className="mt-1 font-semibold text-snack-text">{place.review_count} {place.review_count === 1 ? 'post' : 'posts'}</p>
              </div>
              <a
                href={`https://www.google.com/maps?q=${place.lat},${place.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-snack-surface px-4 py-3 transition hover:bg-[#eef2f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snack-primary focus-visible:ring-offset-2"
                aria-label={`Open ${place.name} in maps`}
              >
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">Directions</p>
                <p className="mt-1 font-semibold text-snack-primary">Open in maps</p>
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
                  type="button"
                  onClick={() => setSort(s)}
                  aria-pressed={sort === s}
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
            <div className="card py-12 text-center">
              <p className="font-medium text-snack-text">No reviews yet.</p>
              <p className="mt-1 text-sm text-snack-muted">Be the first person to post a snack from this place.</p>
              <Link href={`/add-review?placeId=${place.id}`} className="btn-primary mt-4 text-sm">
                Write the first review
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <ReviewCard
                  key={r.id}
                  review={{ ...r, place: { id: place.id, name: place.name, address: place.address } }}
                  showPlace={false}
                  photoVariantPreference={['large', 'medium', 'thumb']}
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
