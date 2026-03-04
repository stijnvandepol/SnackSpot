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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🍟 Latest Reviews</h1>
      </div>

      {initial && loading && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-48 animate-pulse bg-gray-100" />
          ))}
        </div>
      )}

      {!initial && reviews.length === 0 && (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🍽️</p>
          <p className="text-gray-500">No reviews yet – be the first!</p>
          <a href="/add-review" className="btn-primary mt-4 inline-block">Add a Review</a>
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
          <div className="h-6 w-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!hasMore && reviews.length > 0 && (
        <p className="text-center text-sm text-gray-400 py-6">You've seen it all! 🎉</p>
      )}
    </div>
  )
}
