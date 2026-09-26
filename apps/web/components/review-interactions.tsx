'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { ReviewLikeButton } from '@/components/review-like-button'
import { AvatarLightbox } from '@/components/avatar-lightbox'
import { MentionText } from '@/components/mention-text'
import { Modal } from '@/components/ui/modal'
import { authHref } from '@/lib/next-path'

interface CommentItem {
  id: string
  text: string
  createdAt: string
  updatedAt: string
  user: { id: string; username: string; avatarKey?: string | null; role: string }
  canDelete: boolean
}

const dateFormatter = new Intl.DateTimeFormat('nl-NL', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})

function formatDate(dateInput: string) {
  return dateFormatter.format(new Date(dateInput))
}

interface ReviewInteractionsProps {
  reviewId: string
  reviewUserId: string
  reviewUsername: string
  initialLikeCount: number
  initialCommentCount: number
  createdAt: string
  avatarKey?: string | null
  editHref: string
  isOwnerAllowed: boolean
}

export function ReviewInteractions({
  reviewId,
  reviewUserId,
  reviewUsername,
  initialLikeCount,
  initialCommentCount,
  createdAt,
  avatarKey,
  editHref,
  isOwnerAllowed,
}: ReviewInteractionsProps) {
  const { user, accessToken, loading: authLoading } = useAuth()
  const isOwner = !!user && user.id === reviewUserId

  const [likedByMe, setLikedByMe] = useState(false)
  const [likeStatusLoaded, setLikeStatusLoaded] = useState(false)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentCount, setCommentCount] = useState(initialCommentCount)
  const [newComment, setNewComment] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  // Review deletion modal: 'confirm' asks first, 'deleted' offers undo.
  const [deleteStep, setDeleteStep] = useState<'closed' | 'confirm' | 'deleted'>('closed')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [commentToDelete, setCommentToDelete] = useState<CommentItem | null>(null)
  const [commentDeleteBusy, setCommentDeleteBusy] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!accessToken) {
      setLikeStatusLoaded(true)
      return
    }
    // Guard against a stale response landing after reviewId/accessToken changed
    // or the component unmounted (otherwise an older review's state can win).
    let cancelled = false
    fetch(`/api/v1/reviews/${reviewId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json().catch(() => ({})))
      .then((json) => { if (!cancelled) setLikedByMe(Boolean(json.data?.likedByMe)) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLikeStatusLoaded(true) })
    return () => { cancelled = true }
  }, [reviewId, accessToken, authLoading])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/v1/reviews/${reviewId}/comments?limit=50`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
      .then((r) => r.json().catch(() => ({})))
      .then((json) => {
        if (!cancelled && Array.isArray(json.data)) setComments(json.data)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCommentsLoading(false) })
    return () => { cancelled = true }
  }, [reviewId, accessToken])

  const submitComment = async () => {
    if (!accessToken || !newComment.trim()) return
    setCommentSubmitting(true)
    setCommentError(null)
    try {
      const res = await fetch(`/api/v1/reviews/${reviewId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ text: newComment.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.data) {
        setCommentError('Je reactie is niet geplaatst. Probeer het opnieuw.')
        return
      }
      setComments((prev) => [json.data, ...prev])
      setCommentCount((n) => n + 1)
      setNewComment('')
    } finally {
      setCommentSubmitting(false)
    }
  }

  const deleteComment = async (commentId: string) => {
    if (!accessToken) return
    setCommentError(null)
    setCommentDeleteBusy(true)
    try {
      const res = await fetch(`/api/v1/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        setCommentError('Verwijderen is niet gelukt. Probeer het opnieuw.')
        return
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      setCommentCount((n) => Math.max(0, n - 1))
    } finally {
      setCommentDeleteBusy(false)
      setCommentToDelete(null)
    }
  }

  const deleteReview = async () => {
    if (!accessToken) return
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/v1/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        setDeleteError('Verwijderen is niet gelukt. Probeer het opnieuw.')
        return
      }
      setDeleteStep('deleted')
    } catch {
      setDeleteError('Verwijderen is niet gelukt. Probeer het opnieuw.')
    } finally {
      setDeleteBusy(false)
    }
  }

  const undoDeleteReview = async () => {
    if (!accessToken) return
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/v1/reviews/${reviewId}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        setDeleteError('Herstellen is niet gelukt. Probeer het opnieuw.')
        return
      }
      setDeleteStep('closed')
    } catch {
      setDeleteError('Herstellen is niet gelukt. Probeer het opnieuw.')
    } finally {
      setDeleteBusy(false)
    }
  }

  const submitReport = async () => {
    if (!accessToken || !reportReason.trim()) return
    setReporting(true)
    setReportError(null)
    const res = await fetch('/api/v1/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ targetType: 'REVIEW', reviewId, reason: reportReason }),
    })
    setReporting(false)
    if (res.ok) {
      setReported(true)
      setReportReason('')
    } else {
      setReportError('Je melding is niet verstuurd. Probeer het opnieuw.')
    }
  }

  return (
    <>
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 pt-1">
          {likeStatusLoaded && (
            <ReviewLikeButton
              reviewId={reviewId}
              initialLikeCount={initialLikeCount}
              initialLikedByMe={likedByMe}
            />
          )}
          <p className="text-xs text-snack-muted">{commentCount} {commentCount === 1 ? 'reactie' : 'reacties'}</p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-snack-border">
          <div className="flex items-center gap-2">
            <AvatarLightbox avatarKey={avatarKey} username={reviewUsername} size="md" />
            <Link href={`/u/${reviewUsername}`} className="text-sm text-snack-muted hover:underline">
              {reviewUsername}
            </Link>
          </div>
          <time className="text-xs text-snack-muted">{formatDate(createdAt)}</time>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-heading font-semibold text-snack-text">Reacties</h2>

        {user ? (
          <div className="space-y-2">
            <textarea
              className="input min-h-[84px] text-sm"
              placeholder="Schrijf een reactie…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              maxLength={1000}
              aria-label="Schrijf een reactie"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-snack-muted">Houd het vriendelijk. {newComment.length}/1000</p>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={submitComment}
                disabled={commentSubmitting || newComment.trim().length < 1}
              >
                {commentSubmitting ? 'Plaatsen…' : 'Reactie plaatsen'}
              </button>
            </div>
            {commentError && <p className="text-sm text-red-600" role="status" aria-live="polite">{commentError}</p>}
          </div>
        ) : (
          <div className="rounded-xl border border-snack-border bg-snack-surface px-4 py-3 text-sm text-snack-muted">
            <Link href={authHref('login', `/review/${reviewId}`)} className="text-snack-primary hover:underline">Log in</Link> om te reageren.
            Nog geen account?{' '}
            <Link href={authHref('register', `/review/${reviewId}`)} className="text-snack-primary hover:underline">Account maken</Link>
          </div>
        )}

        {commentsLoading ? (
          <p className="text-sm text-snack-muted">Reacties laden…</p>
        ) : comments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-snack-border px-4 py-6 text-center text-sm text-snack-muted">
            Nog geen reacties. Heb je een tip of iets toe te voegen? Laat het hier weten.
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-xl border border-snack-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <AvatarLightbox avatarKey={comment.user.avatarKey} username={comment.user.username} size="sm" />
                    <Link href={`/u/${comment.user.username}`} className="text-sm font-medium text-snack-text hover:underline truncate">
                      {comment.user.username}
                    </Link>
                    <time className="text-xs text-snack-muted whitespace-nowrap">{formatDate(comment.createdAt)}</time>
                  </div>
                  {comment.canDelete && (
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => setCommentToDelete(comment)}
                    >
                      Verwijderen
                    </button>
                  )}
                </div>
                <MentionText text={comment.text} className="mt-2 whitespace-pre-line text-sm text-snack-muted" />
              </div>
            ))}
          </div>
        )}
      </div>

      {isOwner && isOwnerAllowed && (
        <div className="flex gap-2">
          <Link href={editHref} className="btn-secondary flex-1 text-center text-sm">Bewerken</Link>
          <button
            type="button"
            className="btn-secondary flex-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => { setDeleteStep('confirm'); setDeleteError(null) }}
          >
            Verwijderen
          </button>
        </div>
      )}

      <Modal
        open={deleteStep === 'confirm'}
        onClose={() => { if (!deleteBusy) setDeleteStep('closed') }}
        title="Review verwijderen?"
      >
        <p className="text-sm text-snack-muted mb-4">
          Je review is dan niet meer zichtbaar. Binnen 30 dagen kun je hem herstellen.
          Daarna wordt hij definitief gewist, samen met de foto&apos;s.
        </p>
        {deleteError && <p className="text-xs text-red-500 mb-3" role="status" aria-live="polite">{deleteError}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1 text-sm" onClick={() => setDeleteStep('closed')} disabled={deleteBusy}>
            Annuleren
          </button>
          <button
            type="button"
            className="flex-1 text-sm py-2 px-4 rounded-xl bg-red-600 text-white hover:bg-red-700 transition font-medium disabled:opacity-50"
            onClick={() => void deleteReview()}
            disabled={deleteBusy}
          >
            {deleteBusy ? 'Verwijderen…' : 'Review verwijderen'}
          </button>
        </div>
      </Modal>

      <Modal
        open={deleteStep === 'deleted'}
        // Deletion is already committed; dismissing without choosing Undo just
        // leaves, same as Done — the deleted review is gone from this page.
        onClose={() => { if (!deleteBusy) window.location.href = '/' }}
        title="Review verwijderd"
      >
        <p className="text-sm text-snack-muted mb-4">
          Je review is verwijderd. Je kunt hem 30 dagen lang herstellen via deze pagina.
        </p>
        {deleteError && <p className="text-xs text-red-500 mb-3" role="status" aria-live="polite">{deleteError}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1 text-sm" onClick={() => void undoDeleteReview()} disabled={deleteBusy}>
            {deleteBusy ? 'Herstellen…' : 'Ongedaan maken'}
          </button>
          <button
            type="button"
            className="btn-primary flex-1 text-sm"
            onClick={() => { window.location.href = '/' }}
            disabled={deleteBusy}
          >
            Klaar
          </button>
        </div>
      </Modal>

      <Modal
        open={commentToDelete !== null}
        onClose={() => { if (!commentDeleteBusy) setCommentToDelete(null) }}
        title="Reactie verwijderen?"
      >
        <p className="text-sm text-snack-muted mb-4">De reactie wordt definitief verwijderd. Dit kun je niet ongedaan maken.</p>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1 text-sm" onClick={() => setCommentToDelete(null)} disabled={commentDeleteBusy}>
            Annuleren
          </button>
          <button
            type="button"
            className="flex-1 text-sm py-2 px-4 rounded-xl bg-red-600 text-white hover:bg-red-700 transition font-medium disabled:opacity-50"
            onClick={() => { if (commentToDelete) void deleteComment(commentToDelete.id) }}
            disabled={commentDeleteBusy}
          >
            {commentDeleteBusy ? 'Verwijderen…' : 'Reactie verwijderen'}
          </button>
        </div>
      </Modal>

      {user && !isOwner && !reported && (
        <details className="rounded-xl border border-snack-border px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-snack-muted hover:text-snack-text">Review melden</summary>
          <div className="mt-3 space-y-2 pl-2 border-l-2 border-snack-border">
            <textarea
              className="input text-sm min-h-[80px]"
              placeholder="Wat klopt er niet aan deze review?"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              maxLength={500}
            />
            <button type="button" onClick={submitReport} disabled={reporting || reportReason.length < 5} className="btn-secondary text-sm py-2">
              {reporting ? 'Versturen…' : 'Melding versturen'}
            </button>
            {reportError && <p className="text-sm text-red-600" role="status" aria-live="polite">{reportError}</p>}
          </div>
        </details>
      )}
      {reported && <p className="text-sm text-green-600">✓ Melding verstuurd. Bedankt, we kijken ernaar.</p>}
    </>
  )
}
