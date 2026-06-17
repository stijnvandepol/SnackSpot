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
  return until.toLocaleDateString()
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
        setExportError(json.error ?? 'Export failed. Please try again.')
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
      setExportMessage('Your data export has been downloaded.')
    } catch {
      setExportError('Export failed. Please try again.')
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
        setRestoreError(json.error ?? 'Could not restore review. Please try again.')
        return
      }
      setDeletedReviews((prev) => prev.filter((r) => r.id !== id))
      setRestoredMessage('Review restored.')
      setTimeout(() => setRestoredMessage(null), 3000)
    } catch {
      setRestoreError('Could not restore review. Please try again.')
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <div className="card p-4">
      <h3 className="font-heading font-semibold text-snack-text mb-1">Privacy &amp; data</h3>
      <p className="text-xs text-snack-muted mb-3">
        We store your profile, reviews, photos, comments, likes, bites and notification
        preferences, nothing else. Read the{' '}
        <Link href="/privacy" className="text-snack-primary hover:underline">privacy policy</Link>{' '}
        for what we keep and for how long.
      </p>

      <button
        type="button"
        className="btn-secondary w-full text-sm"
        onClick={() => void downloadExport()}
        disabled={exporting}
      >
        {exporting ? 'Preparing your export...' : 'Download my data (ZIP)'}
      </button>
      <p className="mt-1 text-xs text-snack-muted">
        All your personal data as JSON plus your uploaded photos (GDPR Art. 15/20).
      </p>
      {exportError && <p className="mt-2 text-xs text-red-500" role="status" aria-live="polite">{exportError}</p>}
      {exportMessage && <p className="mt-2 text-xs text-green-600" role="status" aria-live="polite">{exportMessage}</p>}

      {deletedReviews.length > 0 && (
        <div className="mt-4 border-t border-snack-border pt-3">
          <h4 className="text-sm font-semibold text-snack-text mb-1">Recently deleted reviews</h4>
          <p className="text-xs text-snack-muted mb-2">
            Deleted reviews can be restored for 30 days. After that they are permanently
            erased, including their photos.
          </p>
          <div className="space-y-2">
            {deletedReviews.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-snack-border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-snack-text truncate">{r.dishName ?? r.place.name}</p>
                  <p className="text-xs text-snack-muted truncate">
                    {restorableUntilLabel(r.deletedAt)
                      ? `Restorable until ${restorableUntilLabel(r.deletedAt)}`
                      : r.place.name}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary text-xs py-1.5 px-3 shrink-0"
                  onClick={() => void restoreReview(r.id)}
                  disabled={restoringId === r.id}
                >
                  {restoringId === r.id ? 'Restoring...' : 'Restore'}
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
