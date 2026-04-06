'use client'
import { useState } from 'react'
import type { ImportSummary } from '../../api/import/types'

export default function ExportPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportSummary | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

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

  const handleImport = async () => {
    if (!selectedFile) return
    setImportLoading(true)
    setImportError(null)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      })

      const data: ImportSummary = await res.json()

      if (!res.ok || !data.success) {
        setImportError(data.error || 'Het importeren is mislukt.')
        if (data.tables && Object.keys(data.tables).length > 0) {
          setImportResult(data)
        }
        return
      }

      setImportResult(data)
      setSelectedFile(null)
      // Reset the file input
      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')
      if (fileInput) fileInput.value = ''
    } catch (err) {
      if (err instanceof TypeError) {
        setImportError('Geen verbinding met de server. Controleer je internetverbinding en probeer het opnieuw.')
      } else {
        setImportError('Het importeren is mislukt. Probeer het opnieuw of raadpleeg de serverlogs.')
      }
    } finally {
      setImportLoading(false)
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

      {/* Import section — per D-01 */}
      <div className="card mt-8">
        <h2 className="text-xl font-semibold mb-4">Gegevens importeren</h2>
        <p className="text-gray-600 mb-6">
          Upload een eerder geexporteerd ZIP-archief om alle gegevens te importeren. Bestaande gebruikers en restaurants worden overgeslagen.
        </p>

        <div className="flex items-center gap-4 mb-4">
          <input
            type="file"
            accept=".zip"
            onChange={(e) => {
              setSelectedFile(e.target.files?.[0] ?? null)
              setImportError(null)
              setImportResult(null)
            }}
            disabled={importLoading}
            className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <button
          onClick={handleImport}
          disabled={importLoading || !selectedFile}
          className="btn btn-primary"
        >
          {importLoading ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></span>
              Importeren...
            </>
          ) : (
            'Start Import'
          )}
        </button>

        {importError && (
          <p className="text-sm text-red-600 mt-4">{importError}</p>
        )}

        {/* Summary report — per D-02, D-06, IMP-08 */}
        {importResult && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">
              {importResult.success ? 'Import voltooid' : 'Import mislukt'}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{importResult.totalImported}</p>
                <p className="text-sm text-green-600">Geimporteerd</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{importResult.totalSkipped}</p>
                <p className="text-sm text-yellow-600">Overgeslagen</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{importResult.tablesProcessed}</p>
                <p className="text-sm text-blue-600">Tabellen</p>
              </div>
              {importResult.photos && (
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-purple-700">{importResult.photos.uploaded}</p>
                  <p className="text-sm text-purple-600">Foto&apos;s geupload</p>
                </div>
              )}
            </div>

            {importResult.photos && (importResult.photos.skipped > 0 || importResult.photos.errors.length > 0) && (
              <p className="text-xs text-gray-500 mt-2">
                Foto&apos;s: {importResult.photos.uploaded} geupload, {importResult.photos.skipped} overgeslagen
                {importResult.photos.errors.length > 0 && `, ${importResult.photos.errors.length} fouten`}
              </p>
            )}

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Tabel</th>
                  <th className="text-right py-2 px-3">Geimporteerd</th>
                  <th className="text-right py-2 px-3">Overgeslagen</th>
                  <th className="text-right py-2 px-3">Fouten</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(importResult.tables).map(([table, stats]) => (
                  <tr key={table} className="border-b last:border-0">
                    <td className="py-2 px-3 font-mono text-xs">{table}</td>
                    <td className="text-right py-2 px-3">{stats.imported}</td>
                    <td className="text-right py-2 px-3">{stats.skipped}</td>
                    <td className="text-right py-2 px-3">
                      {stats.errors.length > 0 ? (
                        <span className="text-red-600">{stats.errors.length}</span>
                      ) : (
                        '0'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Show per-table errors if any — per D-06 */}
            {Object.entries(importResult.tables).some(([, s]) => s.errors.length > 0) && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-red-800 mb-2">Foutmeldingen</h4>
                {Object.entries(importResult.tables)
                  .filter(([, s]) => s.errors.length > 0)
                  .map(([table, s]) => (
                    <div key={table} className="mb-2">
                      <p className="text-xs font-semibold text-red-700">{table}:</p>
                      {s.errors.map((err, i) => (
                        <p key={i} className="text-xs text-red-600 ml-2">{err}</p>
                      ))}
                    </div>
                  ))}
              </div>
            )}

            {/* Show photo-specific errors if any */}
            {importResult.photos && importResult.photos.errors.length > 0 && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-red-800 mb-2">Foto-fouten</h4>
                {importResult.photos.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600 ml-2">{err}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
