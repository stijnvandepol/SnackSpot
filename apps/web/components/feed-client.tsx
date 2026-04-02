'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  likeCount?: number
  likedByMe?: boolean
  user: { id: string; username: string; avatarKey?: string | null; role: string }
  place: { id: string; name: string; address: string }
  reviewPhotos: Array<{ photo: { id: string; variants: Record<string, string> } }>
}

export function FeedClient() {
  const { accessToken } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [initial, setInitial] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  // Two refs prevent duplicate fetches:
  // - inFlightRef blocks a second call while one is already in progress
  // - requestedCursorsRef prevents re-fetching a cursor we already requested,
  //   even after inFlightRef resets between React renders
  const inFlightRef = useRef(false)
  const requestedCursorsRef = useRef<Set<string>>(new Set())

  const loadMore = useCallback(async () => {
    if (!hasMore || inFlightRef.current) return
    const cursorKey = cursor ?? '__initial__'
    if (requestedCursorsRef.current.has(cursorKey)) return

    requestedCursorsRef.current.add(cursorKey)
    inFlightRef.current = true
    setLoading(true)
    setError(null)

    try {
      const url = `/api/v1/feed?limit=15${cursor ? `&cursor=${cursor}` : ''}`
      const res = await fetch(url, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      })
      if (!res.ok) throw new Error('Failed to load feed')
      const json = await res.json()
      setReviews((prev) => {
        const byId = new Map(prev.map((r) => [r.id, r]))
        for (const item of json.data.data as Review[]) {
          byId.set(item.id, item)
        }
        return Array.from(byId.values())
      })
      setCursor(json.data.pagination.nextCursor)
      setHasMore(json.data.pagination.hasMore)
    } catch (err) {
      requestedCursorsRef.current.delete(cursorKey)
      if (process.env.NODE_ENV !== 'production') console.error(err)
      setError('Could not load feed. Check your connection and try again.')
    } finally {
      inFlightRef.current = false
      setLoading(false)
      setInitial(false)
    }
  }, [hasMore, cursor, accessToken])

  // Initial load
  useEffect(() => {
    loadMore()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinel.current) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { rootMargin: '200px' },
    )
    obs.observe(sentinel.current)
    return () => obs.disconnect()
  }, [loadMore])

  return (
    <>
      {initial && loading && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-56 animate-pulse bg-snack-surface" />
          ))}
        </div>
      )}

      {!initial && reviews.length === 0 && (
        <div className="text-center py-20">
          <p className="text-snack-muted">No posts available yet.</p>
          <Link href="/add-review" className="btn-primary mt-4 inline-block">Create first post</Link>
        </div>
      )}

      {error && (
        <div className="card p-4 mb-4 border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30" role="status" aria-live="polite">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          <button type="button" className="btn-secondary mt-3 text-sm" onClick={() => { void loadMore() }}>
            Try again
          </button>
        </div>
      )}

      <div className="space-y-4">
        {reviews.map((r, i) => (
          <ReviewCard
            key={r.id}
            review={r}
            photoVariantPreference={['medium', 'large', 'thumb']}
            backContext="feed"
            priority={i === 0}
          />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinel} className="h-4 mt-4" />

      {loading && !initial && (
        <div className="flex justify-center py-6">
          <div className="h-6 w-6 border-2 border-snack-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!hasMore && reviews.length > 0 && (
        <p className="text-center text-sm text-snack-muted py-6">No more snacks to scroll. Time to grab one.</p>
      )}
    </>
  )
}
