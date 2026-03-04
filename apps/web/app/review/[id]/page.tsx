'use client'
import { use, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'

const MINIO_PUBLIC = process.env.NEXT_PUBLIC_MINIO_PUBLIC_URL ?? 'http://localhost:9000'
const BUCKET = process.env.NEXT_PUBLIC_MINIO_BUCKET ?? 'snackspot'

function photoUrl(variants: Record<string, string>): string | null {
  const key = variants?.large ?? variants?.medium ?? variants?.thumb ?? null
  return key ? `${MINIO_PUBLIC}/${BUCKET}/${key}` : null
}

interface Review {
  id: string; rating: number; text: string; dishName?: string | null
  status: string; createdAt: string; updatedAt: string
  user: { id: string; username: string; displayName?: string | null; role: string }
  place: { id: string; name: string; address: string }
  reviewPhotos: Array<{ sortOrder: number; photo: { id: string; variants: Record<string, string> } }>
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, accessToken } = useAuth()
  const [review, setReview] = useState<Review | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState(false)

  useEffect(() => {
    fetch(`/api/v1/reviews/${id}`)
      .then((r) => r.json())
      .then((json) => json.data ? setReview(json.data) : setError('Review not found'))
      .catch(() => setError('Failed to load review'))
  }, [id])

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
      <p className="text-5xl mb-4">😕</p>
      <p className="text-gray-700 font-semibold">{error}</p>
      <Link href="/feed" className="btn-primary mt-4 inline-block">Back to Feed</Link>
    </div>
  )

  if (!review) return (
    <div className="mx-auto max-w-lg px-4 py-6 animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded-xl w-2/3" />
      <div className="h-48 bg-gray-100 rounded-2xl" />
      <div className="h-4 bg-gray-100 rounded w-full" />
      <div className="h-4 bg-gray-100 rounded w-4/5" />
    </div>
  )

  const photos = review.reviewPhotos.sort((a, b) => a.sortOrder - b.sortOrder)
  const isOwner = user?.id === review.user.id

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      {/* Photo gallery */}
      {photos.length > 0 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(photos.length, 3)}, 1fr)` }}>
          {photos.map((rp) => {
            const url = photoUrl(rp.photo.variants)
            return url ? (
              <div key={rp.photo.id} className="aspect-square rounded-2xl overflow-hidden bg-gray-100">
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
            {review.dishName && <p className="font-bold text-lg text-gray-900">{review.dishName}</p>}
            <Link href={`/place/${review.place.id}`} className="text-sm text-amber-600 hover:underline">
              {review.place.name}
            </Link>
          </div>
          <div className="text-amber-400 text-lg flex-shrink-0">
            {'★'.repeat(review.rating)}<span className="text-gray-200">{'★'.repeat(5 - review.rating)}</span>
          </div>
        </div>

        <p className="text-gray-700 whitespace-pre-line">{review.text}</p>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-semibold text-xs uppercase">
              {(review.user.displayName ?? review.user.username)[0]}
            </div>
            <span className="text-sm text-gray-600">{review.user.displayName ?? review.user.username}</span>
          </div>
          <time className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</time>
        </div>
      </div>

      {/* Owner actions */}
      {isOwner && (
        <div className="flex gap-2">
          <Link href={`/review/${id}/edit`} className="btn-secondary flex-1 text-center text-sm">Edit</Link>
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
          <summary className="cursor-pointer text-gray-400 hover:text-gray-600">🚩 Report this review</summary>
          <div className="mt-3 space-y-2 pl-2 border-l-2 border-gray-100">
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
