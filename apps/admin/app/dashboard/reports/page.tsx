'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Report {
  id: string
  targetType: string
  reason: string
  status: string
  createdAt: string
  reporter: { id: string; username: string; email: string }
  review: {
    id: string
    text: string
    status: string
    rating: number
    user: { id: string; username: string }
    place: { id: string; name: string }
  } | null
  photo: {
    id: string
    moderationStatus: string
    uploadedById: string
  } | null
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('OPEN')
  const [typeFilter, setTypeFilter] = useState('')

  const loadReports = async () => {
    const token = localStorage.getItem('admin_token')
    if (!token) return

    setLoading(true)
    try {
      const url = `/api/reports?page=${page}&status=${statusFilter}&targetType=${typeFilter}`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setReports(data.reports || [])
      setTotal(data.pagination?.total || 0)
    } catch (error) {
      console.error('Error loading reports:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [page, statusFilter, typeFilter])

  const handleAction = async (reportId: string, action: string, targetId: string) => {
    const token = localStorage.getItem('admin_token')
    if (!token) return

    const actionName = action === 'DISMISS' ? 'afwijzen' : 'uitvoeren'
    if (!confirm(`Weet je zeker dat je deze actie wilt ${actionName}?`)) return

    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, targetId }),
      })

      if (res.ok) {
        alert('Actie uitgevoerd!')
        loadReports()
      } else {
        const data = await res.json()
        alert(`Fout: ${data.error}`)
      }
    } catch (error) {
      alert('Er is een fout opgetreden')
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-red-100 text-red-800'
      case 'RESOLVED':
        return 'bg-green-100 text-green-800'
      case 'DISMISSED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'REVIEW':
        return 'bg-blue-100 text-blue-800'
      case 'PHOTO':
        return 'bg-purple-100 text-purple-800'
      case 'USER':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">🚨 Meldingen</h1>
      </div>

      <div className="card mb-6">
        <div className="flex gap-4">
          <select
            className="input w-48"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="OPEN">Open</option>
            <option value="RESOLVED">Afgehandeld</option>
            <option value="DISMISSED">Afgewezen</option>
            <option value="">Alle statussen</option>
          </select>
          <select
            className="input w-48"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Alle types</option>
            <option value="REVIEW">Reviews</option>
            <option value="PHOTO">Foto's</option>
            <option value="USER">Gebruikers</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Laden...</div>
      ) : (
        <>
          {reports.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-5xl mb-4">✅</p>
              <p className="text-gray-600">Geen meldingen gevonden</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div key={report.id} className="card">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded text-sm font-medium ${getTypeBadgeColor(report.targetType)}`}>
                        {report.targetType}
                      </span>
                      <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusBadgeColor(report.status)}`}>
                        {report.status === 'OPEN' ? 'Open' : report.status === 'RESOLVED' ? 'Afgehandeld' : 'Afgewezen'}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(report.createdAt).toLocaleString('nl-NL')}
                    </span>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>Gemeld door:</strong>{' '}
                      <Link
                        href={`/dashboard/users/${report.reporter.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        @{report.reporter.username}
                      </Link>
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Reden:</strong>
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      <p className="text-gray-800">{report.reason}</p>
                    </div>
                  </div>

                  {report.review && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm font-semibold mb-2">Gerapporteerde review:</p>
                      <div className="flex items-center gap-2 mb-2">
                        <Link
                          href={`/dashboard/users/${report.review.user.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          @{report.review.user.username}
                        </Link>
                        <span className="text-gray-400">→</span>
                        <Link
                          href={`/dashboard/places/${report.review.place.id}`}
                          className="text-green-600 hover:text-green-800 font-medium"
                        >
                          {report.review.place.name}
                        </Link>
                        <span className="text-yellow-600 font-medium ml-2">
                          ⭐ {report.review.rating}/5
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ml-2 ${
                          report.review.status === 'PUBLISHED'
                            ? 'bg-green-100 text-green-800'
                            : report.review.status === 'HIDDEN'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {report.review.status}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm">{report.review.text}</p>
                    </div>
                  )}

                  {report.photo && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm font-semibold mb-2">Gerapporteerde foto:</p>
                      <p className="text-sm text-gray-600">
                        Photo ID: {report.photo.id} | Status: {report.photo.moderationStatus}
                      </p>
                    </div>
                  )}

                  {report.status === 'OPEN' && (
                    <div className="flex gap-2 pt-4 border-t">
                      {report.review && (
                        <>
                          <button
                            onClick={() => handleAction(report.id, 'HIDE_REVIEW', report.review!.id)}
                            className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
                          >
                            Verberg review
                          </button>
                          <button
                            onClick={() => handleAction(report.id, 'DELETE_REVIEW', report.review!.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Verwijder review
                          </button>
                        </>
                      )}
                      {report.photo && (
                        <button
                          onClick={() => handleAction(report.id, 'DELETE_PHOTO', report.photo!.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Verwijder foto
                        </button>
                      )}
                      <button
                        onClick={() => handleAction(report.id, 'DISMISS', report.id)}
                        className="text-gray-600 hover:text-gray-800 text-sm font-medium ml-auto"
                      >
                        Afwijzen
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Totaal: {total} meldingen
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
                disabled={reports.length < 50}
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
