'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { ReviewLikeButton } from '@/components/review-like-button'
import { AvatarLightbox } from '@/components/avatar-lightbox'
import { MentionText } from '@/components/mention-text'
import { Modal } from '@/components/ui/modal'

interface CommentItem {
  id: string
  text: string
  createdAt: string
  updatedAt: string
  user: { id: string; username: string; avatarKey?: string | null; role: string }
  canDelete: boolean
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
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
        setCommentError('Could not post comment. Please try again.')
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
        setCommentError('Could not delete comment. Please try again.')
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
        setDeleteError('Could not delete review. Please try again.')
        return
      }
      setDeleteStep('deleted')
    } catch {
      setDeleteError('Could not delete review. Please try again.')
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
        setDeleteError('Could not restore review. Please try again.')
        return
      }
      setDeleteStep('closed')
    } catch {
      setDeleteError('Could not restore review. Please try again.')
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
      setReportError('Could not submit report. Please try again.')
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
          <p className="text-xs text-snack-muted">{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</p>
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
              <p className="text-xs text-snack-muted">Keep it constructive. {newComment.length}/1000</p>
              <button
                type="button"
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
          <div className="rounded-xl border border-snack-border bg-snack-surface px-4 py-3 text-sm text-snack-muted">
            <Link href="/auth/login" className="text-snack-primary hover:underline">Log in</Link> to join the conversation.
          </div>
        )}

        {commentsLoading ? (
          <p className="text-sm text-snack-muted">Loading comments...</p>
        ) : comments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-snack-border px-4 py-6 text-center text-sm text-snack-muted">
            No comments yet. Be the first to add context or a recommendation.
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
                      Delete
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
          <Link href={editHref} className="btn-secondary flex-1 text-center text-sm">Edit</Link>
          <button
            type="button"
            className="btn-secondary flex-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => { setDeleteStep('confirm'); setDeleteError(null) }}
          >
            Delete
          </button>
        </div>
      )}

      <Modal
        open={deleteStep === 'confirm'}
        onClose={() => { if (!deleteBusy) setDeleteStep('closed') }}
        title="Delete this review?"
      >
        <p className="text-sm text-snack-muted mb-4">
          Your review will no longer be visible. You can restore it within 30 days;
          after that it is permanently erased, including its photos.
        </p>
        {deleteError && <p className="text-xs text-red-500 mb-3" role="status" aria-live="polite">{deleteError}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1 text-sm" onClick={() => setDeleteStep('closed')} disabled={deleteBusy}>
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 text-sm py-2 px-4 rounded-xl bg-red-600 text-white hover:bg-red-700 transition font-medium disabled:opacity-50"
            onClick={() => void deleteReview()}
            disabled={deleteBusy}
          >
            {deleteBusy ? 'Deleting...' : 'Delete review'}
          </button>
        </div>
      </Modal>

      <Modal
        open={deleteStep === 'deleted'}
        // Deletion is already committed; dismissing without choosing Undo just
        // leaves, same as Done — the deleted review is gone from this page.
        onClose={() => { if (!deleteBusy) window.location.href = '/' }}
        title="Review deleted"
      >
        <p className="text-sm text-snack-muted mb-4">
          Your review has been deleted. You can restore it from this page for 30 days.
        </p>
        {deleteError && <p className="text-xs text-red-500 mb-3" role="status" aria-live="polite">{deleteError}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1 text-sm" onClick={() => void undoDeleteReview()} disabled={deleteBusy}>
            {deleteBusy ? 'Restoring...' : 'Undo'}
          </button>
          <button
            type="button"
            className="btn-primary flex-1 text-sm"
            onClick={() => { window.location.href = '/' }}
            disabled={deleteBusy}
          >
            Done
          </button>
        </div>
      </Modal>

      <Modal
        open={commentToDelete !== null}
        onClose={() => { if (!commentDeleteBusy) setCommentToDelete(null) }}
        title="Delete this comment?"
      >
        <p className="text-sm text-snack-muted mb-4">This permanently deletes the comment. This cannot be undone.</p>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1 text-sm" onClick={() => setCommentToDelete(null)} disabled={commentDeleteBusy}>
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 text-sm py-2 px-4 rounded-xl bg-red-600 text-white hover:bg-red-700 transition font-medium disabled:opacity-50"
            onClick={() => { if (commentToDelete) void deleteComment(commentToDelete.id) }}
            disabled={commentDeleteBusy}
          >
            {commentDeleteBusy ? 'Deleting...' : 'Delete comment'}
          </button>
        </div>
      </Modal>

      {user && !isOwner && !reported && (
        <details className="rounded-xl border border-snack-border px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-snack-muted hover:text-snack-text">Report this review</summary>
          <div className="mt-3 space-y-2 pl-2 border-l-2 border-snack-border">
            <textarea
              className="input text-sm min-h-[80px]"
              placeholder="Describe the issue…"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              maxLength={500}
            />
            <button type="button" onClick={submitReport} disabled={reporting || reportReason.length < 5} className="btn-secondary text-sm py-2">
              {reporting ? 'Sending…' : 'Submit report'}
            </button>
            {reportError && <p className="text-sm text-red-600" role="status" aria-live="polite">{reportError}</p>}
          </div>
        </details>
      )}
      {reported && <p className="text-sm text-green-600">✓ Report submitted. Thank you.</p>}
    </>
  )
}
