'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Place {
  id: string
  name: string
  address: string
  createdAt: string
  _count: { reviews: number }
}

export default function PlacesPage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showWithoutReviews, setShowWithoutReviews] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newPlace, setNewPlace] = useState({ name: '', address: '', lat: '', lng: '' })

  const loadPlaces = async () => {
    setLoading(true)
    try {
      const url = `/api/places?page=${page}&search=${search}&withoutReviews=${showWithoutReviews}`
      const res = await fetch(url)
      const data = await res.json()
      setPlaces(data.places || [])
      setTotal(data.pagination?.total || 0)
    } catch (error) {
      console.error('Error loading places:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlaces()
  }, [page, search, showWithoutReviews])

  const handleDeletePlace = async (placeId: string, name: string) => {
    if (!confirm(`Weet je zeker dat je restaurant "${name}" wilt verwijderen?`)) return

    try {
      const res = await fetch(`/api/places/${placeId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        alert('Restaurant verwijderd')
        loadPlaces()
      } else {
        const data = await res.json()
        alert(`Fout: ${data.error}`)
      }
    } catch (error) {
      alert('Er is een fout opgetreden')
    }
  }

  const handleDeletePlacesWithoutReviews = async () => {
    if (!confirm('Weet je zeker dat je ALLE restaurants zonder reviews wilt verwijderen?')) return

    try {
      const res = await fetch('/api/places', {
        method: 'DELETE',
      })

      const data = await res.json()
      if (res.ok) {
        alert(`${data.deletedCount} restaurants verwijderd`)
        loadPlaces()
      } else {
        alert(`Fout: ${data.error}`)
      }
    } catch (error) {
      alert('Er is een fout opgetreden')
    }
  }

  const handleCreatePlace = async () => {
    if (!newPlace.name || !newPlace.address || !newPlace.lat || !newPlace.lng) {
      alert('Alle velden zijn verplicht')
      return
    }

    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newPlace.name,
          address: newPlace.address,
          lat: parseFloat(newPlace.lat),
          lng: parseFloat(newPlace.lng),
        }),
      })

      if (res.ok) {
        alert('Restaurant aangemaakt!')
        setShowCreateModal(false)
        setNewPlace({ name: '', address: '', lat: '', lng: '' })
        loadPlaces()
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
        <h1 className="text-3xl font-bold">🏪 Restaurants</h1>
        <div className="flex gap-2">
          <button
            onClick={handleDeletePlacesWithoutReviews}
            className="btn btn-danger"
          >
            Verwijder zonder reviews
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            + Nieuw restaurant
          </button>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Zoek op naam of adres..."
            className="input flex-1"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showWithoutReviews}
              onChange={(e) => {
                setShowWithoutReviews(e.target.checked)
                setPage(1)
              }}
            />
            <span>Alleen zonder reviews</span>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Laden...</div>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Naam</th>
                  <th>Adres</th>
                  <th>Reviews</th>
                  <th>Aangemaakt</th>
                  <th>Acties</th>
                </tr>
              </thead>
              <tbody>
                {places.map((place) => (
                  <tr key={place.id}>
                    <td className="font-medium">{place.name}</td>
                    <td>{place.address}</td>
                    <td>
                      {place._count.reviews === 0 ? (
                        <span className="text-gray-400">0</span>
                      ) : (
                        <span className="font-medium">{place._count.reviews}</span>
                      )}
                    </td>
                    <td>{new Date(place.createdAt).toLocaleDateString('nl-NL')}</td>
                    <td>
                      <div className="flex gap-2">
                        <Link
                          href={`/dashboard/places/${place.id}`}
                          className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                        >
                          Bewerk
                        </Link>
                        <button
                          onClick={() => handleDeletePlace(place.id, place.name)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Verwijder
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Totaal: {total} restaurants
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
                disabled={places.length < 50}
                className="btn btn-secondary"
              >
                Volgende
              </button>
            </div>
          </div>
        </>
      )}

      {/* Create Place Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Nieuw restaurant aanmaken</h2>
            <div className="space-y-4 mb-4">
              <div>
                <label className="label">Naam</label>
                <input
                  type="text"
                  className="input"
                  value={newPlace.name}
                  onChange={(e) => setNewPlace({ ...newPlace, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Adres</label>
                <input
                  type="text"
                  className="input"
                  value={newPlace.address}
                  onChange={(e) => setNewPlace({ ...newPlace, address: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Latitude (bijv. 52.370216)</label>
                <input
                  type="text"
                  className="input"
                  value={newPlace.lat}
                  onChange={(e) => setNewPlace({ ...newPlace, lat: e.target.value })}
                  placeholder="52.370216"
                />
              </div>
              <div>
                <label className="label">Longitude (bijv. 4.895168)</label>
                <input
                  type="text"
                  className="input"
                  value={newPlace.lng}
                  onChange={(e) => setNewPlace({ ...newPlace, lng: e.target.value })}
                  placeholder="4.895168"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreatePlace} className="btn btn-primary">
                Aanmaken
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewPlace({ name: '', address: '', lat: '', lng: '' })
                }}
                className="btn btn-secondary"
              >
                Annuleer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
