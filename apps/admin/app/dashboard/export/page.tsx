'use client'
import { useState } from 'react'

export default function ExportPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/export')

      if (!res.ok) {
        throw new Error('server')
      }

      // Get the blob from the streaming response
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Extract filename from Content-Disposition or use default
      const disposition = res.headers.get('Content-Disposition')
      const filenameMatch = disposition?.match(/filename="(.+)"/)
      a.download = filenameMatch ? filenameMatch[1] : `snackspot-export-${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      if (err instanceof TypeError) {
        // Network error (fetch failed)
        setError('Geen verbinding met de server. Controleer je internetverbinding en probeer het opnieuw.')
      } else {
        setError('Het exporteren is mislukt. Probeer het opnieuw of raadpleeg de serverlogs.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-8">Export / Import</h1>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Gegevens exporteren</h2>
        <p className="text-gray-600 mb-6">
          Maak een volledige backup van alle databaserecords en foto&apos;s. Het archief wordt als ZIP-bestand gedownload.
        </p>
        <button
          onClick={handleExport}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></span>
              Exporteren...
            </>
          ) : (
            'Download Export'
          )}
        </button>
        {error && (
          <p className="text-sm text-red-600 mt-4">{error}</p>
        )}
      </div>

      <div className="mt-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
        <p className="text-sm text-orange-900">
          Het export-archief bevat alle gebruikers, restaurants, reviews en foto&apos;s. Tokens en sessiedata worden niet meegenomen.
        </p>
      </div>
    </div>
  )
}
