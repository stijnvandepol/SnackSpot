'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { BiteLightbox } from '@/components/bite-lightbox'
import { Modal } from '@/components/ui/modal'
import { photoVariantUrl } from '@/lib/photo-url'
import { mealEmoji, mealLabel } from '@/lib/meal'
import { formatDateMedium } from '@/lib/time'

interface Bite {
  id: string
  mealSlot: string
  note: string | null
  visibility: string
  localDate: string
  createdAt: string
  reviewId: string | null
  photo: { id: string; variants: Record<string, string> }
  place: { id: string; name: string } | null
}

export default function MyBitesPage() {
  const { user, accessToken } = useAuth()
  const [bites, setBites] = useState<Bite[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [zoomBite, setZoomBite] = useState<Bite | null>(null)
  const [toDelete, setToDelete] = useState<Bite | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const requestedRef = useRef<Set<string>>(new Set())

  const loadPage = useCallback(
    async (nextCursor: string | null) => {
      if (!accessToken) return
      const key = nextCursor ?? '__first__'
      if (requestedRef.current.has(key)) return
      requestedRef.current.add(key)
      setLoading(true)
      setLoadError(null)
      try {
        const url = `/api/v1/me/bites?limit=24${nextCursor ? `&cursor=${encodeURIComponent(nextCursor)}` : ''}`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setLoadError('Could not load your bites. Please try again.')
          requestedRef.current.delete(key)
          return
        }
        setBites((prev) => [...prev, ...(json.data?.data ?? [])])
        setCursor(json.data?.pagination?.nextCursor ?? null)
        setHasMore(Boolean(json.data?.pagination?.hasMore))
      } catch {
        setLoadError('Could not load your bites. Please try again.')
        requestedRef.current.delete(key)
      } finally {
        setLoading(false)
      }
    },
    [accessToken],
  )

  useEffect(() => {
    if (accessToken) void loadPage(null)
  }, [accessToken, loadPage])

  // Infinite scroll: load the next page when the sentinel comes into view.
  // The observer stays mounted regardless of `loading` — loadPage's requestedRef
  // dedup already prevents duplicate fetches, so depending on `loading` here only
  // thrashed the observer (tear down + rebuild) each load cycle.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && cursor) void loadPage(cursor)
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [cursor, hasMore, loadPage])

  const deleteBite = async (id: string) => {
    if (!accessToken) return
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/v1/bites/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        setDeleteError('Could not delete this bite. Please try again.')
        return
      }
      setBites((prev) => prev.filter((b) => b.id !== id))
      setToDelete(null)
      setFeedback('Bite deleted.')
      setTimeout(() => setFeedback(null), 3000)
    } catch {
      setDeleteError('Could not delete this bite. Please try again.')
    } finally {
      setDeleteBusy(false)
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-semibold text-snack-text">Log in to view your bites.</p>
        <a href="/auth/login" className="btn-primary mt-4 inline-block">Log in</a>
      </div>
    )
  }

  const isInitialLoading = loading && bites.length === 0

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="font-heading font-bold text-xl text-snack-text">My Bites</h1>
        <Link href="/add-bite" className="btn-primary text-sm">Log a bite</Link>
      </div>

      {feedback && (
        <p className="mb-3 text-sm text-green-600" role="status" aria-live="polite">{feedback}</p>
      )}
      {loadError && (
        <p className="mb-3 text-sm text-red-600" role="status" aria-live="polite">{loadError}</p>
      )}

      {isInitialLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-snack-surface" />
          ))}
        </div>
      ) : bites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-snack-border px-4 py-12 text-center">
          <p className="text-3xl" aria-hidden="true">🍟</p>
          <p className="mt-2 text-sm text-snack-muted">You haven&apos;t logged any bites yet.</p>
          <Link href="/add-bite" className="btn-primary mt-4 inline-block text-sm">Log your first bite</Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {bites.map((bite) => {
            const src = photoVariantUrl(bite.photo.variants, ['medium', 'thumb', 'large'])
            const dateLabel = formatDateMedium(bite.createdAt)
            const label = mealLabel(bite.mealSlot)
            return (
              <li key={bite.id} className="card group relative overflow-hidden p-0">
                <div className="aspect-square bg-snack-surface">
                  {src ? (
                    <button
                      type="button"
                      onClick={() => setZoomBite(bite)}
                      className="block h-full w-full cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-inset focus:ring-snack-primary"
                      aria-label={`View ${label} bite photo from ${dateLabel}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- user photo via variant URL */}
                      <img src={src} alt={bite.note ?? `${label} bite`} className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">
                      {mealEmoji(bite.mealSlot)}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setToDelete(bite); setDeleteError(null) }}
                  aria-label={`Delete ${label} bite from ${dateLabel}`}
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1.5 text-white opacity-100 transition hover:bg-red-600 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </button>
                <div className="p-2">
                  <p className="text-xs font-medium text-snack-text">
                    <span aria-hidden="true">{mealEmoji(bite.mealSlot)}</span> {label}
                  </p>
                  <p className="text-[11px] text-snack-muted">{dateLabel}</p>
                  {bite.place && <p className="truncate text-[11px] text-snack-muted">{bite.place.name}</p>}
                  {bite.note && <p className="mt-1 line-clamp-2 text-[11px] text-snack-muted">{bite.note}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {hasMore && bites.length > 0 && (
        <div ref={sentinelRef} className="py-6 text-center text-xs text-snack-muted">
          {loading ? 'Loading more…' : ''}
        </div>
      )}

      <BiteLightbox bite={zoomBite} onClose={() => setZoomBite(null)} />

      <Modal
        open={toDelete !== null}
        onClose={() => { if (!deleteBusy) setToDelete(null) }}
        title="Delete this bite?"
      >
        <p className="text-sm text-snack-muted mb-4">
          This removes the bite from your log. This cannot be undone.
        </p>
        {deleteError && <p className="text-xs text-red-500 mb-3" role="status" aria-live="polite">{deleteError}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1 text-sm" onClick={() => setToDelete(null)} disabled={deleteBusy}>
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 text-sm py-2 px-4 rounded-xl bg-red-600 text-white hover:bg-red-700 transition font-medium disabled:opacity-50"
            onClick={() => { if (toDelete) void deleteBite(toDelete.id) }}
            disabled={deleteBusy}
          >
            {deleteBusy ? 'Deleting…' : 'Delete bite'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
