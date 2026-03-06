'use client'
import { use, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { photoVariantUrl } from '@/lib/photo-url'
import { ReviewLikeButton } from '@/components/review-like-button'
import { avatarUrl } from '@/lib/avatar'

interface Review {
  id: string; rating: number; text: string; dishName?: string | null
  status: string; createdAt: string; updatedAt: string
  likeCount?: number; likedByMe?: boolean
  overallRating?: number
  ratings?: { taste: number; value: number; portion: number; service?: number | null }
  user: { id: string; username: string; avatarKey?: string | null; role: string }
  place: { id: string; name: string; address: string }
  reviewPhotos: Array<{ sortOrder: number; photo: { id: string; variants: Record<string, string> } }>
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, accessToken } = useAuth()
  const searchParams = useSearchParams()
  const [review, setReview] = useState<Review | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState(false)

  useEffect(() => {
    fetch(`/api/v1/reviews/${id}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
      .then((r) => r.json())
      .then((json) => json.data ? setReview(json.data) : setError('Review not found'))
      .catch(() => setError('Failed to load review'))
  }, [id, accessToken])

  const submitReport = async () => {
    if (!accessToken || !reportReason.trim()) return
    setReporting(true)
    const res = await fetch('/api/v1/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ targetType: 'REVIEW', reviewId: id, reason: reportReason }),
    })
    setReporting(false)
    if (res.ok) { setReported(true); setReportReason('') }
  }

  if (error) return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-snack-text font-semibold">{error}</p>
      <Link href="/feed" className="btn-primary mt-4 inline-block">Back to Feed</Link>
    </div>
  )

  if (!review) return (
    <div className="mx-auto max-w-lg px-4 py-6 animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded-xl w-2/3" />
      <div className="h-48 bg-snack-surface rounded-2xl" />
      <div className="h-4 bg-snack-surface rounded w-full" />
      <div className="h-4 bg-snack-surface rounded w-4/5" />
    </div>
  )

  const photos = review.reviewPhotos.sort((a, b) => a.sortOrder - b.sortOrder)
  const isOwner = user?.id === review.user.id
  const from = searchParams.get('from')

  const parsedPlaceContext = (() => {
    if (!from || !from.startsWith('place:')) return null
    const parts = from.split(':')
    const placeId = parts[1] ?? ''
    const encodedOrigin = parts.slice(2).join(':')
    const origin = encodedOrigin ? decodeURIComponent(encodedOrigin) : 'search'
    return placeId ? { placeId, origin } : null
  })()

  const backHref = (() => {
    if (!from) return '/feed'
    if (from === 'feed') return '/feed'
    if (from === 'profile') return '/profile'
    if (parsedPlaceContext) {
      return `/place/${encodeURIComponent(parsedPlaceContext.placeId)}?from=${encodeURIComponent(parsedPlaceContext.origin)}`
    }
    if (from.startsWith('user:')) {
      const username = from.slice('user:'.length)
      return username ? `/u/${encodeURIComponent(username)}` : '/feed'
    }
    return '/feed'
  })()

  const editHref = from
    ? `/review/${id}/edit?from=${encodeURIComponent(from)}`
    : `/review/${id}/edit`

  const placeLinkHref = parsedPlaceContext
    ? `/place/${encodeURIComponent(parsedPlaceContext.placeId)}?from=${encodeURIComponent(parsedPlaceContext.origin)}`
    : `/place/${review.place.id}?from=feed`

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Link href={backHref} className="btn-secondary text-sm">
          ← Back
        </Link>
      </div>

      {/* Photo gallery */}
      {photos.length > 0 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(photos.length, 3)}, 1fr)` }}>
          {photos.map((rp) => {
            const url = photoVariantUrl(rp.photo.variants, ['large', 'medium', 'thumb'])
            return url ? (
              <div key={rp.photo.id} className="aspect-square rounded-2xl overflow-hidden bg-snack-surface">
                <img src={url} alt="" className="h-full w-full object-cover" />
              </div>
            ) : null
          })}
        </div>
      )}

      {/* Review body */}
      <div className="card p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            {review.dishName && <p className="font-heading font-bold text-lg text-snack-text">{review.dishName}</p>}
            <Link href={placeLinkHref} className="text-sm text-snack-primary hover:underline">
              {review.place.name}
            </Link>
          </div>
          <div className="text-snack-rating text-lg flex-shrink-0">
            {'★'.repeat(Math.round(review.overallRating ?? review.rating))}
            <span className="text-[#e0e0e0]">{'★'.repeat(5 - Math.round(review.overallRating ?? review.rating))}</span>
            <p className="text-xs text-snack-muted text-right mt-0.5">{(review.overallRating ?? review.rating).toFixed(1)}</p>
          </div>
        </div>

        {review.ratings && (
          <p className="text-xs text-snack-muted">
            Taste {review.ratings.taste} • Value {review.ratings.value} • Portion {review.ratings.portion}
            {typeof review.ratings.service === 'number' ? ` • Service ${review.ratings.service}` : ''}
          </p>
        )}

        <p className="text-snack-muted whitespace-pre-line">{review.text}</p>

        <div className="pt-1">
          <ReviewLikeButton
            reviewId={review.id}
            initialLikeCount={review.likeCount ?? 0}
            initialLikedByMe={Boolean(review.likedByMe)}
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#ededed]">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-snack-surface flex items-center justify-center text-snack-primary font-semibold text-xs uppercase">
              {review.user.avatarKey ? (
                <img src={avatarUrl(review.user.avatarKey) ?? undefined} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                review.user.username[0]
              )}
            </div>
            <Link href={`/u/${review.user.username}`} className="text-sm text-snack-muted hover:underline">
              {review.user.username}
            </Link>
          </div>
          <time className="text-xs text-snack-muted">{new Date(review.createdAt).toLocaleDateString()}</time>
        </div>
      </div>

      {/* Owner actions */}
      {isOwner && (
        <div className="flex gap-2">
          <Link href={editHref} className="btn-secondary flex-1 text-center text-sm">Edit</Link>
          <button
            className="btn-secondary flex-1 text-sm text-red-600 hover:bg-red-50"
            onClick={async () => {
              if (!confirm('Delete this review?')) return
              await fetch(`/api/v1/reviews/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })
              window.location.href = '/feed'
            }}
          >
            Delete
          </button>
        </div>
      )}

      {/* Report section */}
      {user && !isOwner && !reported && (
        <details className="text-sm">
          <summary className="cursor-pointer text-snack-muted hover:text-snack-text">Report this review</summary>
          <div className="mt-3 space-y-2 pl-2 border-l-2 border-[#ececec]">
            <textarea
              className="input text-sm min-h-[80px]"
              placeholder="Describe the issue…"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              maxLength={500}
            />
            <button onClick={submitReport} disabled={reporting || reportReason.length < 5} className="btn-secondary text-sm py-2">
              {reporting ? 'Sending…' : 'Submit report'}
            </button>
          </div>
        </details>
      )}
      {reported && <p className="text-sm text-green-600">✓ Report submitted. Thank you.</p>}
    </div>
  )
}
