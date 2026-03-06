'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { PlaceCard } from '@/components/place-card'

interface Place {
  id: string; name: string; address: string; avg_rating: number | null; review_count: number
}

export default function SearchPage() {
  const [q, setQ] = useState('')
  const [places, setPlaces] = useState<Place[]>([])
  const [featuredPlaces, setFeaturedPlaces] = useState<Place[]>([])
  const [featuredLoading, setFeaturedLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/v1/places/featured?limit=8')
      .then((res) => {
        if (!res.ok) throw new Error('Featured fetch failed')
        return res.json()
      })
      .then((json) => setFeaturedPlaces(json.data?.data ?? []))
      .catch((err) => console.error(err))
      .finally(() => setFeaturedLoading(false))
  }, [])

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/v1/places/search?q=${encodeURIComponent(query)}&limit=30`)
      if (!res.ok) throw new Error('Search failed')
      const json = await res.json()
      setPlaces(json.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    search(q)
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
        setSearched(false)
        inputRef.current?.blur()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 space-y-1">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-snack-text">Explore</h1>
        <p className="text-sm text-snack-muted">Search for snack spots and dishes.</p>
        <p className="text-xs text-snack-muted">Tip: press / to focus search.</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/feed" className="btn-secondary text-sm py-2">Back to Feed</Link>
        <Link href="/nearby" className="btn-secondary text-sm py-2">Use Nearby</Link>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          ref={inputRef}
          type="search"
          className="input flex-1"
          placeholder="Search places, dishes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        {q.length > 0 && (
          <button
            type="button"
            className="btn-secondary flex-shrink-0"
            onClick={() => {
              setQ('')
              setPlaces([])
              setSearched(false)
              inputRef.current?.focus()
            }}
          >
            Clear
          </button>
        )}
        <button type="submit" className="btn-primary flex-shrink-0" disabled={loading}>
          {loading ? '…' : 'Search'}
        </button>
      </form>

      {!searched && (
        <div className="mb-6">
          <div className="mb-3">
            <h2 className="text-lg font-heading font-semibold text-snack-text">Recent activity</h2>
            <p className="text-xs text-snack-muted">Recently added reviews</p>
          </div>

          {featuredLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card h-20 animate-pulse bg-snack-surface" />
              ))}
            </div>
          ) : featuredPlaces.length > 0 ? (
            <div className="space-y-3">
              {featuredPlaces.map((p) => (
                <PlaceCard
                  key={p.id}
                  place={{ id: p.id, name: p.name, address: p.address, avgRating: p.avg_rating, reviewCount: p.review_count }}
                />
              ))}
            </div>
          ) : (
            <div className="text-sm text-snack-muted">Nog geen recente reviews beschikbaar.</div>
          )}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card h-20 animate-pulse bg-snack-surface" />
          ))}
        </div>
      )}

      {!loading && searched && places.length === 0 && (
        <div className="text-center py-16">
          <p className="text-snack-muted">No results for &ldquo;{q}&rdquo;.</p>
          <button
            type="button"
            className="btn-secondary mt-3 text-sm"
            onClick={() => {
              setQ('')
              setPlaces([])
              setSearched(false)
              inputRef.current?.focus()
            }}
          >
            Try another search
          </button>
        </div>
      )}

      {!searched && featuredPlaces.length === 0 && !featuredLoading && (
        <div className="text-center py-16">
          <p className="text-snack-muted">Search for a place or dish name.</p>
        </div>
      )}

      <div className="space-y-3">
        {places.map((p) => (
          <PlaceCard
            key={p.id}
            place={{ id: p.id, name: p.name, address: p.address, avgRating: p.avg_rating, reviewCount: p.review_count }}
          />
        ))}
      </div>
    </div>
  )
}
