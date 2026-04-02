'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ReviewCard } from '@/components/review-card'
import { useAuth } from '@/components/auth-provider'

interface Review {
  id: string
  rating: number
  text: string
  dishName?: string | null
  createdAt: string
  status: string
  overallRating?: number
  ratings?: { taste: number; value: number; portion: number; service?: number | null }
  tags?: string[]
  likeCount?: number
  commentCount?: number
  likedByMe?: boolean
  user: { id: string; username: string; avatarKey?: string | null; role: string }
  reviewPhotos: Array<{ photo: { id: string; variants: Record<string, string> } }>
}

interface PlaceReviewsSectionProps {
  placeId: string
  placeName: string
  placeAddress: string
  from?: string
}

export function PlaceReviewsSection({ placeId, placeName, placeAddress, from }: PlaceReviewsSectionProps) {
  const { accessToken, loading: authLoading } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [sort, setSort] = useState<'new' | 'top'>('new')
  const [loading, setLoading] = useState(true)
  const [reviewsError, setReviewsError] = useState<string | null>(null)

  const fetchReviews = useCallback(() => {
    if (authLoading) return
    setLoading(true)
    setReviewsError(null)
    fetch(`/api/v1/places/${placeId}/reviews?sort=${sort}&limit=20`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
      .then((r) => r.json())
      .then((json) => setReviews(json.data?.data ?? []))
      .catch(() => setReviewsError('Could not load reviews for this place.'))
      .finally(() => setLoading(false))
  }, [placeId, sort, accessToken, authLoading])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  return (
    <>
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
          <Link href={`/add-review?placeId=${placeId}`} className="btn-primary mt-4 text-sm">
            Write the first review
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <ReviewCard
              key={r.id}
              review={{ ...r, place: { id: placeId, name: placeName, address: placeAddress } }}
              showPlace={false}
              photoVariantPreference={['large', 'medium', 'thumb']}
              backContext={`place:${placeId}:${encodeURIComponent(from ?? 'search')}`}
            />
          ))}
        </div>
      )}
    </>
  )
}
