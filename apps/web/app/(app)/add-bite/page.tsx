'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { normalizeUploadMime, shouldUseDirectBrowserUpload, compressImage } from '@/lib/upload'
import { MEAL_SLOTS, type MealSlot } from '@/lib/meal'
import { AuthGate } from '@/components/auth-gate'
import { FileImagePreview } from '@/components/file-image-preview'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

function defaultMealSlot(): MealSlot {
  const hour = new Date().getHours()
  if (hour < 11) return 'BREAKFAST'
  if (hour < 15) return 'LUNCH'
  if (hour >= 17 && hour < 23) return 'DINNER'
  return 'SNACK'
}

interface SearchPlace {
  id: string
  name: string
  address: string
}

interface BiteSuccess {
  xpAwarded: number
  level: number
  title: string
  leveledUp: boolean
  streakCurrent: number
  placeId: string | null
  photoUsedForReview: boolean
}

export default function AddBitePage() {
  const { user, accessToken, loading } = useAuth()
  const [photoId, setPhotoId] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [photoStatus, setPhotoStatus] = useState<'idle' | 'uploading' | 'ready' | 'error'>('idle')
  const [mealSlot, setMealSlot] = useState<MealSlot>(defaultMealSlot)
  const [note, setNote] = useState('')
  const [showPlace, setShowPlace] = useState(false)
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<SearchPlace[]>([])
  const [selectedPlace, setSelectedPlace] = useState<SearchPlace | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<BiteSuccess | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)

  // Cancel a pending debounced search + in-flight request on unmount so neither
  // fires against an unmounted component.
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
      searchAbortRef.current?.abort()
    }
  }, [])

  if (loading) return null
  if (!user) {
    return (
      <AuthGate
        title="Een bite vastleggen"
        body="Leg in een paar seconden vast wat je at. Daarvoor heb je een gratis account nodig."
        returnTo={'/add-bite'}
      />
    )
  }

  const handleFileSelect = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file || !accessToken) return

    const normalizedMime = normalizeUploadMime(file)
    if (!normalizedMime) {
      setError('Dit bestand kunnen we niet gebruiken. Kies een JPG, PNG, WEBP, AVIF of HEIC.')
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES * 2) {
      setError(`Deze foto is te groot (${(file.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB). Maximaal 10 MB.`)
      return
    }

    setError(null)
    setPhotoStatus('uploading')
    setPreviewFile(file)

    try {
      let uploadBlob: Blob = file
      let uploadMime = normalizedMime
      try {
        const compressed = await compressImage(file)
        uploadBlob = compressed.blob
        uploadMime = compressed.mime
      } catch {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          throw new Error('Deze foto is te groot. Kies een kleinere foto.')
        }
      }

      const initRes = await fetch('/api/v1/photos/initiate-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ filename: file.name, contentType: uploadMime, size: uploadBlob.size }),
      })
      if (!initRes.ok) throw new Error('Uploaden kon niet starten. Probeer het opnieuw.')
      const { data: initData } = await initRes.json()

      let uploaded = false
      if (shouldUseDirectBrowserUpload(initData.uploadUrl)) {
        try {
          const putRes = await fetch(initData.uploadUrl, {
            method: 'PUT',
            body: uploadBlob,
            headers: { 'Content-Type': uploadMime },
          })
          uploaded = putRes.ok
        } catch {
          uploaded = false
        }
      }
      if (!uploaded) {
        const fallbackRes = await fetch(
          `/api/v1/photos/upload-fallback?photoId=${encodeURIComponent(initData.photoId)}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': uploadMime },
            body: uploadBlob,
          },
        )
        if (!fallbackRes.ok) throw new Error('Uploaden mislukt. Probeer het opnieuw.')
      }

      const confirmRes = await fetch('/api/v1/photos/confirm-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ photoId: initData.photoId }),
      })
      if (!confirmRes.ok) throw new Error('Foto verwerken mislukt. Probeer het opnieuw.')

      setPhotoId(initData.photoId)
      setPhotoStatus('ready')
    } catch (err) {
      setPhotoStatus('error')
      setError(err instanceof Error ? err.message : 'Foto uploaden mislukt. Probeer het opnieuw.')
    }
  }

  const handlePlaceSearch = (query: string) => {
    setPlaceQuery(query)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (query.trim().length < 2) {
      setPlaceResults([])
      return
    }
    searchTimeoutRef.current = setTimeout(() => {
      // Abort any earlier in-flight search so a slow response can't overwrite a
      // newer query's results out of order.
      searchAbortRef.current?.abort()
      const controller = new AbortController()
      searchAbortRef.current = controller
      fetch(`/api/v1/places/search?q=${encodeURIComponent(query)}&limit=6`, { credentials: 'include', signal: controller.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('search failed'))))
        .then((json) => setPlaceResults(json.data?.data ?? []))
        .catch((err) => { if (err?.name !== 'AbortError') setPlaceResults([]) })
    }, 300)
  }

  const handleSubmit = async () => {
    if (!photoId || photoStatus !== 'ready') {
      setError('Maak eerst een foto van je eten.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/bites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          photoId,
          placeId: selectedPlace?.id,
          mealSlot,
          note: note.trim() || undefined,
          visibility: 'FRIENDS',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Je bite is niet opgeslagen. Probeer het opnieuw.')
        return
      }
      setSuccess({
        xpAwarded: json.data.xp.awarded,
        level: json.data.xp.level,
        title: json.data.xp.title,
        leveledUp: json.data.xp.leveledUp,
        streakCurrent: json.data.streak.current,
        placeId: selectedPlace?.id ?? null,
        photoUsedForReview: false,
      })
    } catch {
      setError('Er ging iets mis. Probeer het opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setPhotoId(null)
    setPreviewFile(null)
    setPhotoStatus('idle')
    setMealSlot(defaultMealSlot())
    setNote('')
    setShowPlace(false)
    setPlaceQuery('')
    setPlaceResults([])
    setSelectedPlace(null)
    setSuccess(null)
    setError(null)
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center space-y-5">
        <div className="text-6xl" aria-hidden="true">🔥</div>
        <h1 className="text-2xl font-heading font-bold text-snack-text">
          {success.streakCurrent} {success.streakCurrent === 1 ? 'dag' : 'dagen'} op rij
        </h1>
        <p className="text-snack-muted">
          Bite vastgelegd{success.xpAwarded > 0 ? ` · +${success.xpAwarded} XP` : ''}
          {success.leveledUp ? ` · Je bent nu level ${success.level} (${success.title})` : ''}
        </p>
        <div className="space-y-2">
          {/* The conversion moment: nudge the private bite toward a public review. */}
          <Link
            href={success.placeId ? `/add-review?placeId=${encodeURIComponent(success.placeId)}` : '/add-review'}
            className="btn-primary block w-full"
          >
            Maak er een review van → +75 XP
          </Link>
          <button type="button" className="btn-secondary block w-full" onClick={resetForm}>
            Nog een bite loggen
          </button>
          <Link href="/bites" className="btn-secondary block w-full">
            Mijn bites bekijken
          </Link>
          <Link href="/" className="block w-full py-2 text-sm text-snack-muted hover:text-snack-primary">
            Klaar
          </Link>
        </div>
      </div>
    )
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-5">
      {/* Review-first nudge: the strongest steer sits above everything else. */}
      <Link
        href="/add-review"
        className="block rounded-xl border border-snack-primary/30 bg-snack-primary/10 px-4 py-3 text-sm"
      >
        <span className="font-semibold text-snack-text">Eet je iets dat je wilt aanraden?</span>{' '}
        <span className="text-snack-primary font-semibold">Schrijf een review → +75 XP</span>
        <span className="mt-0.5 block text-xs text-snack-muted">
          Een review is openbaar en blijft staan, zodat anderen de plek ook vinden.
        </span>
      </Link>

      <div>
        <h1 className="text-2xl font-heading font-bold text-snack-text">Bite</h1>
        <p className="mt-1 text-sm text-snack-muted">
          Een snelle foto van wat je nu eet. Je vrienden zien hem 24 uur in hun feed, daarna
          verdwijnt hij. Telt mee voor je dagen op rij. +10 XP
        </p>
      </div>

      <input
        id="bite-photo-input"
        ref={fileInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          void handleFileSelect(e.target.files)
          e.currentTarget.value = ''
        }}
      />

      {previewFile ? (
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-snack-surface">
          <FileImagePreview file={previewFile} label="Je maaltijd" className="h-full w-full" />
          {photoStatus === 'uploading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          )}
          <label
            htmlFor="bite-photo-input"
            className="absolute bottom-2 right-2 cursor-pointer rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white"
          >
            Opnieuw
          </label>
        </div>
      ) : (
        <label
          htmlFor="bite-photo-input"
          className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-snack-border bg-snack-surface text-snack-muted transition hover:border-snack-primary hover:text-snack-primary"
        >
          <span className="text-5xl" aria-hidden="true">📸</span>
          <span className="text-sm font-semibold">Maak een foto van je eten</span>
        </label>
      )}

      <div>
        <p className="label">Maaltijd</p>
        <div className="flex gap-2">
          {MEAL_SLOTS.map((slot) => (
            <button
              key={slot.value}
              type="button"
              onClick={() => setMealSlot(slot.value)}
              aria-pressed={mealSlot === slot.value}
              className={`flex-1 rounded-xl border px-2 py-2 text-xs font-medium transition ${
                mealSlot === slot.value
                  ? 'border-snack-primary bg-snack-surface text-snack-primary'
                  : 'border-snack-border text-snack-muted'
              }`}
            >
              <span className="block text-base" aria-hidden="true">{slot.emoji}</span>
              {slot.label}
            </button>
          ))}
        </div>
      </div>

      {selectedPlace ? (
        <div className="flex items-center justify-between rounded-xl border border-snack-border bg-snack-surface px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-snack-text">{selectedPlace.name}</p>
            <p className="text-xs text-snack-muted">{selectedPlace.address}</p>
          </div>
          <button
            type="button"
            className="text-xs text-snack-muted hover:text-snack-primary"
            onClick={() => { setSelectedPlace(null); setShowPlace(false); setPlaceQuery('') }}
          >
            Weghalen
          </button>
        </div>
      ) : showPlace ? (
        <div className="relative">
          <label className="label">Waar eet je?</label>
          <input
            className="input"
            placeholder="Zoek een plek…"
            value={placeQuery}
            onChange={(e) => handlePlaceSearch(e.target.value)}
            autoComplete="off"
          />
          {placeResults.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-snack-border bg-snack-background shadow-lg">
              {placeResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="block w-full border-b border-snack-border px-4 py-3 text-left transition last:border-b-0 hover:bg-snack-surface"
                  onClick={() => { setSelectedPlace(p); setPlaceResults([]) }}
                >
                  <span className="block text-sm font-medium text-snack-text">{p.name}</span>
                  <span className="block text-xs text-snack-muted">{p.address}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="text-sm font-medium text-snack-primary hover:underline"
          onClick={() => setShowPlace(true)}
        >
          + Plek toevoegen (optioneel)
        </button>
      )}

      <div>
        <label className="label">
          Notitie <span className="font-normal text-snack-muted">(optioneel, {note.length}/280)</span>
        </label>
        <input
          className="input"
          placeholder="Bijv. patatje oorlog na het sporten"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={280}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400" role="status" aria-live="polite">
          {error}
        </div>
      )}

      <button
        type="button"
        className="btn-primary w-full"
        disabled={submitting || photoStatus === 'uploading' || !photoId}
        onClick={handleSubmit}
      >
        {submitting ? 'Opslaan…' : photoStatus === 'uploading' ? 'Uploaden…' : 'Bite loggen'}
      </button>

      <p className="text-center text-xs text-snack-muted">
        Iets om aan te raden?{' '}
        <Link href="/add-review" className="font-medium text-snack-primary hover:underline">
          Schrijf een volledige review
        </Link>
      </p>
    </div>
  )
}
