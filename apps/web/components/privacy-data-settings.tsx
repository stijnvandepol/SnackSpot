'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'

interface DeletedReview {
  id: string
  text: string
  dishName?: string | null
  deletedAt?: string | null
  place: { name: string }
}

const RESTORE_WINDOW_DAYS = 30

function restorableUntilLabel(deletedAt: string | null | undefined): string | null {
  if (!deletedAt) return null
  const until = new Date(new Date(deletedAt).getTime() + RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  return until.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Settings card for GDPR rights: data export (Art. 15/20), restore window for
 * deleted reviews (undo of Art. 17 erasure requests) and the privacy policy.
 */
export function PrivacyDataSettings() {
  const { accessToken } = useAuth()
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [deletedReviews, setDeletedReviews] = useState<DeletedReview[]>([])
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoredMessage, setRestoredMessage] = useState<string | null>(null)

  const loadDeleted = useCallback(() => {
    if (!accessToken) return
    fetch('/api/v1/me/reviews?deleted=1&limit=20', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json().catch(() => ({})))
      .then((json) => setDeletedReviews(json.data?.data ?? []))
      .catch(() => {})
  }, [accessToken])

  useEffect(() => {
    loadDeleted()
  }, [loadDeleted])

  const downloadExport = async () => {
    if (!accessToken) return
    setExporting(true)
    setExportError(null)
    setExportMessage(null)
    try {
      const res = await fetch('/api/v1/me/export', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setExportError(json.error ?? 'Exporteren is mislukt. Probeer het opnieuw.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `snackspot-my-data-${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setExportMessage('Je gegevens zijn gedownload.')
    } catch {
      setExportError('Exporteren is mislukt. Probeer het opnieuw.')
    } finally {
      setExporting(false)
    }
  }

  const restoreReview = async (id: string) => {
    if (!accessToken) return
    setRestoringId(id)
    setRestoreError(null)
    setRestoredMessage(null)
    try {
      const res = await fetch(`/api/v1/reviews/${id}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setRestoreError(json.error ?? 'Review terugzetten is mislukt. Probeer het opnieuw.')
        return
      }
      setDeletedReviews((prev) => prev.filter((r) => r.id !== id))
      setRestoredMessage('Review teruggezet.')
      setTimeout(() => setRestoredMessage(null), 3000)
    } catch {
      setRestoreError('Review terugzetten is mislukt. Probeer het opnieuw.')
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <div className="card p-4">
      <h3 className="font-heading font-semibold text-snack-text mb-1">Privacy en gegevens</h3>
      <p className="text-xs text-snack-muted mb-3">
        We bewaren je profiel, reviews, foto&apos;s, reacties, likes, bites en
        meldingsinstellingen, verder niets. In de{' '}
        <Link href="/privacy" className="text-snack-primary hover:underline">privacyverklaring</Link>{' '}
        lees je wat we bewaren en hoe lang.
      </p>

      <button
        type="button"
        className="btn-secondary w-full text-sm"
        onClick={() => void downloadExport()}
        disabled={exporting}
      >
        {exporting ? 'Export klaarzetten…' : 'Download mijn gegevens (ZIP)'}
      </button>
      <p className="mt-1 text-xs text-snack-muted">
        Al je persoonsgegevens als JSON, plus je geüploade foto&apos;s (AVG art. 15 en 20).
      </p>
      {exportError && <p className="mt-2 text-xs text-red-500" role="status" aria-live="polite">{exportError}</p>}
      {exportMessage && <p className="mt-2 text-xs text-green-600" role="status" aria-live="polite">{exportMessage}</p>}

      {deletedReviews.length > 0 && (
        <div className="mt-4 border-t border-snack-border pt-3">
          <h4 className="text-sm font-semibold text-snack-text mb-1">Onlangs verwijderde reviews</h4>
          <p className="text-xs text-snack-muted mb-2">
            Verwijderde reviews kun je 30 dagen terugzetten. Daarna worden ze met foto&apos;s
            en al definitief gewist.
          </p>
          <div className="space-y-2">
            {deletedReviews.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-snack-border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-snack-text truncate">{r.dishName ?? r.place.name}</p>
                  <p className="text-xs text-snack-muted truncate">
                    {restorableUntilLabel(r.deletedAt)
                      ? `Terug te zetten tot ${restorableUntilLabel(r.deletedAt)}`
                      : r.place.name}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary text-xs py-1.5 px-3 shrink-0"
                  onClick={() => void restoreReview(r.id)}
                  disabled={restoringId === r.id}
                >
                  {restoringId === r.id ? 'Terugzetten…' : 'Terugzetten'}
                </button>
              </div>
            ))}
          </div>
          {restoreError && <p className="mt-2 text-xs text-red-500" role="status" aria-live="polite">{restoreError}</p>}
          {restoredMessage && <p className="mt-2 text-xs text-green-600" role="status" aria-live="polite">{restoredMessage}</p>}
        </div>
      )}
    </div>
  )
}
