'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ReviewCard } from '@/components/review-card'
import { useAuth } from '@/components/auth-provider'
import { PullToRefresh } from '@/components/pull-to-refresh'

// Module constant so the prop reference is stable across renders — required for
// the memoized ReviewCard to actually skip unchanged cards.
const FEED_VARIANT_PREF = ['medium', 'large', 'thumb'] as const

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

export interface FeedSeed {
  reviews: Review[]
  nextCursor: string | null
  hasMore: boolean
}

export function FeedClient({
  scope = 'discover',
  seed,
}: {
  scope?: 'discover' | 'following'
  /** Server-rendered first page. Anonymous, so `likedByMe` is false on every card. */
  seed?: FeedSeed
}) {
  const { accessToken, loading: authLoading } = useAuth()
  // Seeding the state rather than fetching on mount is what makes the feed exist in the
  // HTML: without it a crawler saw an empty <div> where the reviews should be.
  const [reviews, setReviews] = useState<Review[]>(seed?.reviews ?? [])
  const [cursor, setCursor] = useState<string | null>(seed?.nextCursor ?? null)
  const [hasMore, setHasMore] = useState(seed?.hasMore ?? true)
  const [loading, setLoading] = useState(false)
  const [initial, setInitial] = useState(!seed)
  const [error, setError] = useState<string | null>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  // Two refs prevent duplicate fetches:
  // - inFlightRef blocks a second call while one is already in progress
  // - requestedCursorsRef prevents re-fetching a cursor we already requested,
  //   even after inFlightRef resets between React renders
  const inFlightRef = useRef(false)
  const requestedCursorsRef = useRef<Set<string>>(new Set())

  const loadMore = useCallback(async () => {
    if (authLoading) return
    if (!hasMore || inFlightRef.current) return
    const cursorKey = cursor ?? '__initial__'
    if (requestedCursorsRef.current.has(cursorKey)) return

    requestedCursorsRef.current.add(cursorKey)
    inFlightRef.current = true
    setLoading(true)
    setError(null)

    try {
      const url = `/api/v1/feed?limit=15&scope=${scope}${cursor ? `&cursor=${cursor}` : ''}`
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
      setError('Kon de feed niet laden. Controleer je verbinding en probeer het opnieuw.')
    } finally {
      inFlightRef.current = false
      setLoading(false)
      setInitial(false)
    }
  }, [authLoading, hasMore, cursor, accessToken, scope])

  const refresh = useCallback(async () => {
    requestedCursorsRef.current.clear()
    inFlightRef.current = false
    setCursor(null)
    setHasMore(true)
    setError(null)

    try {
      const url = `/api/v1/feed?limit=15&scope=${scope}`
      const res = await fetch(url, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      })
      if (!res.ok) throw new Error('Failed to load feed')
      const json = await res.json()
      setReviews(json.data.data as Review[])
      setCursor(json.data.pagination.nextCursor)
      setHasMore(json.data.pagination.hasMore)
      requestedCursorsRef.current.add('__initial__')
    } catch {
      setError('Kon de feed niet verversen. Controleer je verbinding en probeer het opnieuw.')
    }
  }, [accessToken, scope])

  // Initial load: wait for auth to finish restoring so likedByMe is accurate.
  // If we load before the token is ready, the feed returns likedByMe: false for
  // every card and never refreshes — likes appear gone after reopening the app.
  //
  // With a server seed there is already content on screen. It was rendered anonymously,
  // so a signed-in viewer still needs one refresh to get their own like state; an
  // anonymous viewer (and every crawler) needs no request at all.
  useEffect(() => {
    if (authLoading) return

    if (!seed) {
      loadMore()
      return
    }

    if (accessToken) {
      void refresh()
    } else {
      // Mark the first page as already fetched so the scroll observer resumes at the
      // seeded cursor instead of re-requesting page one.
      requestedCursorsRef.current.add('__initial__')
    }
  }, [authLoading, accessToken]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <PullToRefresh onRefresh={refresh}>
      {initial && loading && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-56 animate-pulse bg-snack-surface" />
          ))}
        </div>
      )}

      {!initial && reviews.length === 0 && scope === 'discover' && (
        <div className="text-center py-20">
          <p className="text-snack-muted">Er staan nog geen reviews.</p>
          <Link href="/add-review" className="btn-primary mt-4 inline-block">Schrijf de eerste review</Link>
        </div>
      )}

      {!initial && reviews.length === 0 && scope === 'following' && (
        <div className="text-center py-20">
          <p className="font-medium text-snack-text">Nog geen reviews van mensen die je volgt.</p>
          <p className="mt-1 text-sm text-snack-muted">Volg andere gebruikers om hun reviews hier te zien.</p>
          <Link href="/search" className="btn-primary mt-4 inline-block">Zoek mensen en snackplekken</Link>
        </div>
      )}

      {error && (
        <div className="card p-4 mb-4 border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30" role="status" aria-live="polite">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          <button type="button" className="btn-secondary mt-3 text-sm" onClick={() => { void loadMore() }}>
            Opnieuw proberen
          </button>
        </div>
      )}

      <div className="space-y-4">
        {reviews.map((r, i) => (
          <ReviewCard
            key={r.id}
            review={r}
            photoVariantPreference={FEED_VARIANT_PREF}
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
        <p className="text-center text-sm text-snack-muted py-6">Je hebt alles gezien. Zelf iets gegeten? Schrijf een review.</p>
      )}
    </PullToRefresh>
  )
}
