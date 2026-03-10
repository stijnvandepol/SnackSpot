'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PlaceCard } from '@/components/place-card'
import { ReviewCard } from '@/components/review-card'
import { useAuth } from '@/components/auth-provider'
import { REVIEW_TAG_OPTIONS, type ReviewTag, getReviewTagLabel } from '@/lib/review-tags'

interface Place {
  id: string
  name: string
  address: string
  avg_rating: number | null
  review_count: number
}

interface DiscoverReview {
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
  user: { id: string; username: string; avatarKey?: string | null }
  place: { id: string; name: string; address: string }
  reviewPhotos?: Array<{ photo: { id: string; variants: Record<string, string> } }>
}

interface DiscoverResponse {
  freshFinds: DiscoverReview[]
  underTheRadar: DiscoverReview[]
}

type TagFilter = 'all' | ReviewTag

function dedupeReviews(reviews: DiscoverReview[]) {
  const byId = new Map<string, DiscoverReview>()
  for (const review of reviews) {
    byId.set(review.id, review)
  }
  return Array.from(byId.values())
}

export default function SearchPage() {
  const { accessToken } = useAuth()
  const [q, setQ] = useState('')
  const [places, setPlaces] = useState<Place[]>([])
  const [featuredPlaces, setFeaturedPlaces] = useState<Place[]>([])
  const [tagResults, setTagResults] = useState<DiscoverReview[]>([])
  const [activeTag, setActiveTag] = useState<TagFilter>('all')
  const [featuredLoading, setFeaturedLoading] = useState(true)
  const [tagLoading, setTagLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [featuredError, setFeaturedError] = useState<string | null>(null)
  const [tagError, setTagError] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/v1/places/featured?limit=8')
      .then(async (res) => {
        if (!res.ok) throw new Error('Featured fetch failed')
        const json = await res.json()
        setFeaturedPlaces(Array.isArray(json.data?.data) ? json.data.data : [])
      })
      .catch((err) => {
        console.error(err)
        setFeaturedError('Could not load places with recent reviews.')
      })
      .finally(() => setFeaturedLoading(false))
  }, [])

  useEffect(() => {
    if (activeTag === 'all') {
      setTagResults([])
      setTagError(null)
      setTagLoading(false)
      return
    }

    const params = new URLSearchParams({ limit: '8', tag: activeTag })

    setTagLoading(true)
    setTagError(null)
    setPlaces([])
    setSearched(false)

    fetch(`/api/v1/discover?${params.toString()}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Tag search failed')
        const json = await res.json()
        const data = (json.data ?? {}) as DiscoverResponse
        const freshFinds = Array.isArray(data.freshFinds) ? data.freshFinds : []
        const underTheRadar = Array.isArray(data.underTheRadar) ? data.underTheRadar : []
        setTagResults(dedupeReviews([...freshFinds, ...underTheRadar]))
      })
      .catch((err) => {
        console.error(err)
        setTagError('Could not load tagged posts right now.')
      })
      .finally(() => setTagLoading(false))
  }, [activeTag, accessToken])

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return

    setLoading(true)
    setSearched(true)
    setSearchError(null)
    setTagError(null)
    setTagResults([])

    try {
      const res = await fetch(`/api/v1/places/search?q=${encodeURIComponent(query)}&limit=30`)
      if (!res.ok) throw new Error('Search failed')
      const json = await res.json()
      setPlaces(Array.isArray(json.data?.data) ? json.data.data : [])
    } catch (err) {
      console.error(err)
      setSearchError('Search failed. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }, [])

  const resetSearch = useCallback(() => {
    setQ('')
    setPlaces([])
    setTagResults([])
    setActiveTag('all')
    setSearched(false)
    setSearchError(null)
    setTagError(null)
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void search(q)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement !== inputRef.current) {
        event.preventDefault()
        inputRef.current?.focus()
      }

      if (event.key === 'Escape' && document.activeElement === inputRef.current) {
        event.preventDefault()
        setQ('')
        setPlaces([])
        setTagResults([])
        setActiveTag('all')
        setSearched(false)
        setSearchError(null)
        setTagError(null)
        inputRef.current?.blur()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const hasActiveTag = activeTag !== 'all'
  const showDefaultPlaces = !searched && !hasActiveTag
  const showTagResults = hasActiveTag && !searched
  const hasCustomCriteria = searched || hasActiveTag

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 space-y-1">
        <h1 className="text-2xl font-heading font-bold text-snack-text md:text-3xl">Explore</h1>
        <p className="text-sm text-snack-muted">Browse places with recent reviews, or search by name and tags when you know what you want.</p>
        <p className="text-xs text-snack-muted">Tip: press / to focus search.</p>
      </div>

      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          ref={inputRef}
          type="search"
          className="input flex-1"
          placeholder="Search places or dishes..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          aria-label="Search places or dishes"
        />
        {(q.length > 0 || hasActiveTag) && (
          <button type="button" className="btn-secondary flex-shrink-0" onClick={resetSearch}>
            Reset
          </button>
        )}
        <button type="submit" className="btn-primary flex-shrink-0" disabled={loading || q.trim().length === 0}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        {REVIEW_TAG_OPTIONS.map((option) => {
          const isActive = activeTag === option.value

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setActiveTag((prev) => (prev === option.value ? 'all' : option.value))}
              className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                isActive
                  ? 'border-snack-primary bg-snack-primary text-white'
                  : 'border-snack-border bg-white text-snack-muted hover:border-snack-primary hover:text-snack-primary'
              }`}
              title={option.hint}
              aria-pressed={isActive}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {searchError && (
        <div className="card mb-4 border-red-200 bg-red-50/50 p-3" role="status" aria-live="polite">
          <p className="text-sm text-red-700">{searchError}</p>
        </div>
      )}

      {tagError && (
        <div className="card mb-4 border-red-200 bg-red-50/50 p-3" role="status" aria-live="polite">
          <p className="text-sm text-red-700">{tagError}</p>
        </div>
      )}

      {featuredError && showDefaultPlaces && (
        <div className="card mb-4 border-red-200 bg-red-50/50 p-3" role="status" aria-live="polite">
          <p className="text-sm text-red-700">{featuredError}</p>
        </div>
      )}

      {showDefaultPlaces && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-heading font-semibold text-snack-text">Latest review spots</h2>
            <p className="text-xs text-snack-muted">Places where the newest community reviews just landed.</p>
          </div>

          {featuredLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card h-20 animate-pulse bg-snack-surface" />
              ))}
            </div>
          ) : featuredPlaces.length > 0 ? (
            <div className="space-y-3">
              {featuredPlaces.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={{
                    id: place.id,
                    name: place.name,
                    address: place.address,
                    avgRating: place.avg_rating,
                    reviewCount: place.review_count,
                  }}
                  from="search"
                />
              ))}
            </div>
          ) : (
            <div className="card p-4 text-sm text-snack-muted">
              No places with recent reviews yet.
            </div>
          )}
        </section>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card h-20 animate-pulse bg-snack-surface" />
          ))}
        </div>
      )}

      {!loading && searched && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-heading font-semibold text-snack-text">Place results</h2>
            <p className="text-xs text-snack-muted">Search results for &ldquo;{q}&rdquo;.</p>
          </div>

          {places.length > 0 ? (
            <div className="space-y-3">
              {places.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={{
                    id: place.id,
                    name: place.name,
                    address: place.address,
                    avgRating: place.avg_rating,
                    reviewCount: place.review_count,
                  }}
                  from="search"
                />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <p className="text-snack-muted">No results for &ldquo;{q}&rdquo;.</p>
              <button type="button" className="btn-secondary mt-3 text-sm" onClick={resetSearch}>
                Reset search
              </button>
            </div>
          )}
        </section>
      )}

      {showTagResults && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-heading font-semibold text-snack-text">{getReviewTagLabel(activeTag)}</h2>
            <p className="text-xs text-snack-muted">Posts tagged with this discovery cue.</p>
          </div>

          {tagLoading ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="card h-64 animate-pulse bg-snack-surface" />
              ))}
            </div>
          ) : tagResults.length > 0 ? (
            <div className="space-y-4">
              {tagResults.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  photoVariantPreference={['large', 'medium', 'thumb']}
                  backContext="search"
                />
              ))}
            </div>
          ) : (
            <div className="card p-4 text-sm text-snack-muted">
              No posts matched {getReviewTagLabel(activeTag).toLowerCase()} yet.
            </div>
          )}
        </section>
      )}

      {!hasCustomCriteria && !featuredLoading && featuredPlaces.length === 0 && !featuredError && (
        <div className="py-10 text-center text-sm text-snack-muted">
          Try a search or pick a tag to narrow things down.
        </div>
      )}
    </div>
  )
}
