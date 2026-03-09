'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function EditPlacePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [place, setPlace] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')

  useEffect(() => {
    fetch(`/api/places/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setPlace(data.place)
        setName(data.place.name)
        setAddress(data.place.address)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [params.id])

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/places/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, address }),
      })

      if (res.ok) {
        alert('Restaurant bijgewerkt!')
        router.push('/dashboard/places')
      } else {
        const data = await res.json()
        alert(`Fout: ${data.error}`)
      }
    } catch (error) {
      alert('Er is een fout opgetreden')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Laden...</div>
  }

  if (!place) {
    return <div className="text-center py-12">Restaurant niet gevonden</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Restaurant bewerken</h1>

      <div className="card max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="label">Naam</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Adres</label>
            <input
              type="text"
              className="input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-gray-600 mb-2">
              <strong>ID:</strong> {place.id}
            </p>
            <p className="text-sm text-gray-600 mb-2">
              <strong>Aangemaakt:</strong>{' '}
              {new Date(place.createdAt).toLocaleString('nl-NL')}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              <strong>Aantal reviews:</strong> {place._count.reviews}
            </p>

            {place.reviews && place.reviews.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Recente reviews:</h3>
                <div className="space-y-2">
                  {place.reviews.map((review: any) => (
                    <div key={review.id} className="bg-gray-50 p-3 rounded">
                      <p className="text-sm">
                        <strong>{review.user.username}</strong> - ⭐ {review.rating}/5
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{review.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <button onClick={handleSave} className="btn btn-primary">
              Opslaan
            </button>
            <button
              onClick={() => router.push('/dashboard/places')}
              className="btn btn-secondary"
            >
              Annuleer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
