'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AdminReview {
  id: string
  rating: string | number
  ratingTaste: string | number
  ratingValue: string | number
  ratingPortion: string | number
  ratingService: string | number | null
  ratingOverall: string | number
  text: string
  dishName: string | null
  status: string
  createdAt: string
  updatedAt: string
  user: { id: string; username: string; email: string }
  place: { id: string; name: string; address: string }
  _count: { reviewLikes: number }
}

export default function ReviewDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [review, setReview] = useState<AdminReview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/reviews/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setReview(data.review)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [params.id])

  if (loading) {
    return <div className="text-center py-12">Laden...</div>
  }

  if (!review) {
    return <div className="text-center py-12">Review niet gevonden</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Review Details</h1>

      <div className="card max-w-3xl">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Algemene informatie</h2>
            <span
              className={`px-3 py-1 rounded font-medium ${
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

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Gebruiker</p>
              <Link
                href={`/dashboard/users/${review.user.id}`}
                className="text-orange-600 hover:text-orange-700 font-medium"
              >
                @{review.user.username}
              </Link>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Restaurant</p>
              <Link
                href={`/dashboard/places/${review.place.id}`}
                className="text-green-600 hover:text-green-800 font-medium"
              >
                {review.place.name}
              </Link>
            </div>
          </div>

          {review.dishName && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">Gerecht</p>
              <p className="font-medium">{review.dishName}</p>
            </div>
          )}
        </div>

        <div className="border-t pt-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Ratings</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Overall</p>
              <p className="text-2xl font-bold text-yellow-600">
                ⭐ {Number(review.ratingOverall).toFixed(1)}/5.0
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Smaak</p>
              <p className="text-xl font-semibold">{review.ratingTaste}/5</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Prijs/Kwaliteit</p>
              <p className="text-xl font-semibold">{review.ratingValue}/5</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Portiegrootte</p>
              <p className="text-xl font-semibold">{review.ratingPortion}/5</p>
            </div>
            {review.ratingService !== null && (
              <div>
                <p className="text-sm text-gray-600">Service</p>
                <p className="text-xl font-semibold">{review.ratingService}/5</p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t pt-6 mb-6">
          <h3 className="text-lg font-semibold mb-2">Review tekst</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{review.text}</p>
        </div>

        <div className="border-t pt-6 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <strong>ID:</strong> {review.id}
            </div>
            <div>
              <strong>Likes:</strong> {review._count.reviewLikes}
            </div>
            <div>
              <strong>Aangemaakt:</strong>{' '}
              {new Date(review.createdAt).toLocaleString('nl-NL')}
            </div>
            <div>
              <strong>Bijgewerkt:</strong>{' '}
              {new Date(review.updatedAt).toLocaleString('nl-NL')}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <button
            onClick={() => router.push('/dashboard/reviews')}
            className="btn btn-secondary"
          >
            Terug naar lijst
          </button>
        </div>
      </div>
    </div>
  )
}
