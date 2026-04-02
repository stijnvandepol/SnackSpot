'use client'
import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function toSentenceCase(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

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

export default function ReviewDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [review, setReview] = useState<AdminReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [dishNameInput, setDishNameInput] = useState('')
  const [textInput, setTextInput] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!review) return
    setSaving(true)
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textInput.trim(),
          dishName: dishNameInput.trim() || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setReview({ ...review, text: data.review.text, dishName: data.review.dishName })
        setEditMode(false)
        alert('Review bijgewerkt!')
      } else {
        alert('Fout: ' + data.error)
      }
    } catch {
      alert('Er is een fout opgetreden')
    } finally {
      setSaving(false)
    }
  }

  function handleEdit() {
    if (!review) return
    setDishNameInput(review.dishName ?? '')
    setTextInput(review.text)
    setEditMode(true)
  }

  function handleCancel() {
    setEditMode(false)
  }

  useEffect(() => {
    fetch(`/api/reviews/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setReview(data.review)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

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
            <div className="flex items-center gap-2">
              {!editMode && (
                <button onClick={handleEdit} className="btn btn-secondary text-xs px-3 py-1.5">
                  Bewerken
                </button>
              )}
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

          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-1">Gerecht</p>
            {editMode ? (
              <div className="flex gap-2">
                <input
                  className="input"
                  value={dishNameInput}
                  onChange={(e) => setDishNameInput(e.target.value)}
                  placeholder="Naam van het gerecht (optioneel)"
                />
                <button
                  type="button"
                  onClick={() => setDishNameInput(toSentenceCase(dishNameInput))}
                  className="btn btn-secondary text-xs px-3 shrink-0"
                  title="Naar sentence case"
                >
                  Aa
                </button>
              </div>
            ) : (
              <p className="font-medium">{review.dishName ?? <span className="text-gray-400 italic">Geen gerecht opgegeven</span>}</p>
            )}
          </div>
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
          {editMode ? (
            <textarea
              className="input"
              rows={6}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
            />
          ) : (
            <p className="text-gray-700 whitespace-pre-wrap">{review.text}</p>
          )}
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
          {editMode ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="btn btn-secondary"
              >
                Annuleren
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push('/dashboard/reviews')}
              className="btn btn-secondary"
            >
              Terug naar lijst
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
