'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ReviewCard } from '@/components/review-card'

interface Review {
  id: string
  rating: number
  text: string
  dishName?: string | null
  createdAt: string
  status: string
  user: { id: string; username: string; displayName?: string | null; avatarKey?: string | null; role: string }
  place: { id: string; name: string; address: string }
  reviewPhotos: Array<{ photo: { id: string; variants: Record<string, string> } }>
}

export default function FeedPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [initial, setInitial] = useState(true)
  const sentinel = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    try {
      const url = `/api/v1/feed?limit=15${cursor ? `&cursor=${cursor}` : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load feed')
      const json = await res.json()
      setReviews((prev) => [...prev, ...json.data.data])
      setCursor(json.data.pagination.nextCursor)
      setHasMore(json.data.pagination.hasMore)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setInitial(false)
    }
  }, [loading, hasMore, cursor])

  // Initial load
  useEffect(() => {
    loadMore()
  }, []) // eslint-disable-line

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
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-snack-text">Home Feed</h1>
        <p className="text-sm text-snack-muted">Discover snack posts near you — photo first, fast scroll.</p>
      </div>

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
          <a href="/add-review" className="btn-primary mt-4 inline-block">Create first post</a>
        </div>
      )}

      <div className="space-y-4">
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} />
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
        <p className="text-center text-sm text-snack-muted py-6">End of feed.</p>
      )}
    </div>
  )
}
