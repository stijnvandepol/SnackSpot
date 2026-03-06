'use client'
import { use, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { photoVariantUrl } from '@/lib/photo-url'
import { ReviewLikeButton } from '@/components/review-like-button'
import { ImageLightbox } from '@/components/image-lightbox'
import { AvatarLightbox } from '@/components/avatar-lightbox'

interface Review {
  id: string; rating: number; text: string; dishName?: string | null
  status: string; createdAt: string; updatedAt: string
  likeCount?: number; likedByMe?: boolean
  commentCount?: number
  overallRating?: number
  ratings?: { taste: number; value: number; portion: number; service?: number | null }
  user: { id: string; username: string; avatarKey?: string | null; role: string }
  place: { id: string; name: string; address: string }
  reviewPhotos: Array<{ sortOrder: number; photo: { id: string; variants: Record<string, string> } }>
}

interface CommentItem {
  id: string
  text: string
  createdAt: string
  updatedAt: string
  user: { id: string; username: string; avatarKey?: string | null; role: string }
  canDelete: boolean
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
  const [reportError, setReportError] = useState<string | null>(null)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/v1/reviews/${id}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      }),
      fetch(`/api/v1/reviews/${id}/comments?limit=50`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      }),
    ])
      .then(async ([reviewRes, commentsRes]) => {
        const reviewJson = await reviewRes.json().catch(() => ({}))
        if (reviewRes.ok && reviewJson.data) {
          setReview(reviewJson.data)
        } else {
          setError('Review not found')
        }

        const commentsJson = await commentsRes.json().catch(() => ({}))
        if (commentsRes.ok && Array.isArray(commentsJson.data)) {
          setComments(commentsJson.data)
        }
      })
      .catch(() => setError('Failed to load review'))
      .finally(() => setCommentsLoading(false))
  }, [id, accessToken])

  const submitComment = async () => {
    if (!accessToken || !newComment.trim()) return
    setCommentSubmitting(true)
    setCommentError(null)
    try {
      const res = await fetch(`/api/v1/reviews/${id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ text: newComment.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.data) {
        setCommentError('Could not post comment. Please try again.')
        return
      }
      setComments((prev) => [json.data, ...prev])
      setReview((prev) => prev ? { ...prev, commentCount: (prev.commentCount ?? 0) + 1 } : prev)
      setNewComment('')
    } finally {
      setCommentSubmitting(false)
    }
  }

  const deleteComment = async (commentId: string) => {
    if (!accessToken) return
    setCommentError(null)
    const res = await fetch(`/api/v1/comments/${commentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      setCommentError('Could not delete comment. Please try again.')
      return
    }
    setComments((prev) => prev.filter((c) => c.id !== commentId))
    setReview((prev) => prev ? { ...prev, commentCount: Math.max(0, (prev.commentCount ?? 0) - 1) } : prev)
  }

  const submitReport = async () => {
    if (!accessToken || !reportReason.trim()) return
    setReporting(true)
    setReportError(null)
    const res = await fetch('/api/v1/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ targetType: 'REVIEW', reviewId: id, reason: reportReason }),
    })
    setReporting(false)
    if (res.ok) {
      setReported(true)
      setReportReason('')
    } else {
      setReportError('Could not submit report. Please try again.')
    }
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
            const thumbnail = photoVariantUrl(rp.photo.variants, ['medium', 'thumb'])
            const fullSize = photoVariantUrl(rp.photo.variants, ['large', 'medium'])
            return thumbnail && fullSize ? (
              <div key={rp.photo.id} className="aspect-square rounded-2xl overflow-hidden bg-snack-surface">
                <ImageLightbox
                  src={fullSize}
                  thumbnail={thumbnail}
                  alt={review.dishName ?? 'Review photo'}
                  className="h-full w-full object-cover"
                  thumbnailClassName="cursor-zoom-in block w-full h-full"
                />
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
          <p className="text-xs text-snack-muted mt-1">{review.commentCount ?? comments.length} comments</p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#ededed]">
          <div className="flex items-center gap-2">
            <AvatarLightbox avatarKey={review.user.avatarKey} username={review.user.username} size="md" />
            <Link href={`/u/${review.user.username}`} className="text-sm text-snack-muted hover:underline">
              {review.user.username}
            </Link>
          </div>
          <time className="text-xs text-snack-muted">{new Date(review.createdAt).toLocaleDateString()}</time>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-heading font-semibold text-snack-text">Comments</h2>

        {user ? (
          <div className="space-y-2">
            <textarea
              className="input min-h-[84px] text-sm"
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              maxLength={1000}
              aria-label="Write a comment"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-snack-muted">{newComment.length}/1000</p>
              <button
                className="btn-primary text-sm"
                onClick={submitComment}
                disabled={commentSubmitting || newComment.trim().length < 1}
              >
                {commentSubmitting ? 'Posting...' : 'Post comment'}
              </button>
            </div>
            {commentError && <p className="text-sm text-red-600" role="status" aria-live="polite">{commentError}</p>}
          </div>
        ) : (
          <p className="text-sm text-snack-muted">
            <Link href="/auth/login" className="text-snack-primary hover:underline">Log in</Link> to comment.
          </p>
        )}

        {commentsLoading ? (
          <p className="text-sm text-snack-muted">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-snack-muted">No comments yet. Be the first.</p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-xl border border-[#ececec] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <AvatarLightbox avatarKey={comment.user.avatarKey} username={comment.user.username} size="sm" />
                    <Link href={`/u/${comment.user.username}`} className="text-sm font-medium text-snack-text hover:underline truncate">
                      {comment.user.username}
                    </Link>
                    <time className="text-xs text-snack-muted whitespace-nowrap">{new Date(comment.createdAt).toLocaleDateString()}</time>
                  </div>
                  {comment.canDelete && (
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => void deleteComment(comment.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="mt-2 text-sm text-snack-muted whitespace-pre-line">{comment.text}</p>
              </div>
            ))}
          </div>
        )}
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
            {reportError && <p className="text-sm text-red-600" role="status" aria-live="polite">{reportError}</p>}
          </div>
        </details>
      )}
      {reported && <p className="text-sm text-green-600">✓ Report submitted. Thank you.</p>}
    </div>
  )
}
