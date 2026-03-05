'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Review {
  id: string
  rating: number
  ratingOverall: string
  text: string
  status: string
  createdAt: string
  user: { id: string; username: string }
  place: { id: string; name: string }
  _count: { reviewLikes: number }
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')

  const loadReviews = async () => {
    const token = localStorage.getItem('admin_token')
    if (!token) return

    setLoading(true)
    try {
      const url = `/api/reviews?page=${page}&search=${search}&status=${statusFilter}`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setReviews(data.reviews || [])
      setTotal(data.pagination?.total || 0)
    } catch (error) {
      console.error('Error loading reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReviews()
  }, [page, search, statusFilter])

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Weet je zeker dat je deze review permanent wilt verwijderen?')) return

    const token = localStorage.getItem('admin_token')
    if (!token) return

    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        alert('Review verwijderd')
        loadReviews()
      } else {
        const data = await res.json()
        alert(`Fout: ${data.error}`)
      }
    } catch (error) {
      alert('Er is een fout opgetreden')
    }
  }

  const handleChangeStatus = async (reviewId: string, newStatus: string) => {
    const token = localStorage.getItem('admin_token')
    if (!token) return

    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        loadReviews()
      } else {
        const data = await res.json()
        alert(`Fout: ${data.error}`)
      }
    } catch (error) {
      alert('Er is een fout opgetreden')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">⭐ Reviews</h1>
      </div>

      <div className="card mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Zoek op tekst, gebruiker of restaurant..."
            className="input flex-1"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
          <select
            className="input w-48"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Alle statussen</option>
            <option value="PUBLISHED">Gepubliceerd</option>
            <option value="HIDDEN">Verborgen</option>
            <option value="DELETED">Verwijderd</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Laden...</div>
      ) : (
        <>
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="card">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Link
                        href={`/dashboard/users/${review.user.id}`}
                        className="font-semibold text-blue-600 hover:text-blue-800"
                      >
                        @{review.user.username}
                      </Link>
                      <span className="text-gray-400">→</span>
                      <Link
                        href={`/dashboard/places/${review.place.id}`}
                        className="font-semibold text-green-600 hover:text-green-800"
                      >
                        {review.place.name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                      <span className="font-medium text-yellow-600">
                        ⭐ {parseFloat(review.ratingOverall).toFixed(1)}/5.0
                      </span>
                      <span>❤️ {review._count.reviewLikes} likes</span>
                      <span>{new Date(review.createdAt).toLocaleDateString('nl-NL')}</span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          review.status === 'PUBLISHED'
                            ? 'bg-green-100 text-green-800'
                            : review.status === 'HIDDEN'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {review.status}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-gray-700 mb-4">{review.text}</p>

                <div className="flex gap-2 pt-3 border-t">
                  {review.status !== 'PUBLISHED' && (
                    <button
                      onClick={() => handleChangeStatus(review.id, 'PUBLISHED')}
                      className="text-green-600 hover:text-green-800 text-sm font-medium"
                    >
                      Publiceer
                    </button>
                  )}
                  {review.status !== 'HIDDEN' && (
                    <button
                      onClick={() => handleChangeStatus(review.id, 'HIDDEN')}
                      className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
                    >
                      Verberg
                    </button>
                  )}
                  {review.status !== 'DELETED' && (
                    <button
                      onClick={() => handleChangeStatus(review.id, 'DELETED')}
                      className="text-orange-600 hover:text-orange-800 text-sm font-medium"
                    >
                      Soft Delete
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteReview(review.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Permanent Verwijderen
                  </button>
                  <Link
                    href={`/dashboard/reviews/${review.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium ml-auto"
                  >
                    Details
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {reviews.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Geen reviews gevonden
            </div>
          )}

          <div className="mt-6 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Totaal: {total} reviews
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-secondary"
              >
                Vorige
              </button>
              <span className="px-4 py-2">Pagina {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={reviews.length < 50}
                className="btn btn-secondary"
              >
                Volgende
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
