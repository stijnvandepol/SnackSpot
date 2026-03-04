'use client'
import { useCallback, useState } from 'react'
import { PlaceCard } from '@/components/place-card'
import { ReviewCard } from '@/components/review-card'
import { useSearchParams, useRouter } from 'next/navigation'

interface Place {
  id: string; name: string; address: string; avg_rating: number | null; review_count: number
}

export default function SearchPage() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">🔍 Search</h1>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          type="search"
          className="input flex-1"
          placeholder="Search places, dishes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <button type="submit" className="btn-primary flex-shrink-0" disabled={loading}>
          {loading ? '…' : 'Search'}
        </button>
      </form>

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card h-20 animate-pulse bg-gray-100" />
          ))}
        </div>
      )}

      {!loading && searched && places.length === 0 && (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">🤷</p>
          <p className="text-gray-500">No results for &ldquo;{q}&rdquo;</p>
        </div>
      )}

      {!searched && (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">🍔</p>
          <p className="text-gray-500">Search for a place or dish name.</p>
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
