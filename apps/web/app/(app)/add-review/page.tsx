'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { UserMentionInput } from '@/components/user-mention-input'
import { PlacePicker, type PickedPlace } from '@/components/place-picker'
import { computeOverallRating } from '@/lib/ratings'
import { REVIEW_TAG_OPTIONS, type ReviewTag } from '@/lib/review-tags'
import { shouldUseDirectBrowserUpload, normalizeUploadMime, compressImage } from '@/lib/upload'
import { AuthGate } from '@/components/auth-gate'
import { track } from '@/lib/analytics'

type Step = 'place' | 'review' | 'photos'

interface UploadedPhoto {
  photoId: string
  previewUrl: string
  status: 'uploading' | 'confirming' | 'ready' | 'error'
}

interface RatingDraft {
  taste: number
  value: number
  portion: number
  service: number | null
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

function createTempPhotoId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function isHalfStepRating(value: number): boolean {
  return value >= 1 && value <= 5 && Math.abs(value * 2 - Math.round(value * 2)) < Number.EPSILON
}

function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className="relative inline-flex">
          <button
            type="button"
            className="absolute inset-y-0 left-0 z-10 w-1/2"
            aria-label={`${String(s - 0.5).replace('.', ',')} sterren geven`}
            onClick={() => onChange(s - 0.5)}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 z-10 w-1/2"
            aria-label={`${s} ${s === 1 ? 'ster' : 'sterren'} geven`}
            onClick={() => onChange(s)}
          />
          <span
            className={`pointer-events-none text-4xl ${
              value >= s ? 'text-snack-rating' : value === s - 0.5 ? 'text-snack-rating/60' : 'text-snack-border'
            }`}
          >
            ★
          </span>
        </div>
      ))}
      {value >= 1 && <span className="ml-2 text-sm font-semibold text-snack-text">{value.toFixed(1).replace('.', ',')}</span>}
    </div>
  )
}

function AddReviewForm() {
  const { user, accessToken, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillPlaceId = searchParams.get('placeId')
  const returnPath = prefillPlaceId ? `/add-review?placeId=${encodeURIComponent(prefillPlaceId)}` : '/add-review'
  const isDev = process.env.NODE_ENV !== 'production'
  // The photo comes first: the camera is the habit, the details follow.
  const [step, setStep] = useState<Step>('photos')
  // A verified place (existing SnackSpot place or a provider-verified venue).
  const [pickedPlace, setPickedPlace] = useState<PickedPlace | null>(null)
  // Ratings start unset (0) so a published review always reflects a deliberate
  // choice — silent defaults would pollute place averages.
  const [ratings, setRatings] = useState<RatingDraft>({
    taste: 0,
    value: 0,
    portion: 0,
    service: null,
  })
  const [text, setText] = useState('')
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])
  const [dishName, setDishName] = useState('')
  const [selectedTags, setSelectedTags] = useState<ReviewTag[]>([])
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photosRef = useRef<UploadedPhoto[]>([])

  const revokePreviewUrl = (url: string) => {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  }

  // Photos effect mirror (kept in sync for cleanup on unmount).
  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  // Arriving via "Write review" on a place page (?placeId=...) pre-selects that
  // place so the user never has to search for it again.
  useEffect(() => {
    if (!prefillPlaceId) return
    let cancelled = false
    fetch(`/api/v1/places/${encodeURIComponent(prefillPlaceId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Place not found'))))
      .then((json) => {
        if (cancelled) return
        const p = json?.data
        if (!p?.id) return
        setPickedPlace({ placeId: p.id, name: p.name ?? '', address: p.address ?? '' })
      })
      .catch(() => undefined) // unknown place id: the user picks one in the place step
    return () => {
      cancelled = true
    }
  }, [prefillPlaceId])

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => revokePreviewUrl(photo.previewUrl))
    }
  }, [])

  // Counted once per visit by a signed-in user; the gap to "review_created" is the
  // form's own drop-off.
  const reviewStartTracked = useRef(false)
  useEffect(() => {
    if (!user || reviewStartTracked.current) return
    reviewStartTracked.current = true
    track('review_started', { source: prefillPlaceId ? 'place_page' : 'direct' })
  }, [user, prefillPlaceId])

  if (loading) return null

  if (!user) {
    return (
      <AuthGate
        title="Deel wat je at"
        body="Met een gratis account plaats je een fotoreview in een paar tikken. Daarna brengen we je meteen terug naar deze pagina."
        returnTo={returnPath}
      />
    )
  }

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return
    if (!accessToken) {
      setError('Je sessie is nog niet klaar. Wacht even en probeer het opnieuw.')
      return
    }
    const remaining = 5 - photos.length
    const toUpload = Array.from(files).slice(0, remaining)

    // Upload sequentially for better reliability on mobile browsers.
    for (const file of toUpload) {
      const normalizedMime = normalizeUploadMime(file)
      if (!normalizedMime) {
        setError(`${file.name || 'Dit bestand'} kunnen we niet gebruiken. Kies een JPG, PNG, WEBP, AVIF of HEIC.`)
        continue
      }

      if (file.size > MAX_FILE_SIZE_BYTES * 2) {
        setError(`${file.name || 'Deze foto'} is te groot (${(file.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB). Kies een kleinere foto, maximaal 10 MB.`)
        continue
      }

      const previewUrl = URL.createObjectURL(file)
      const tempId = createTempPhotoId()
      let realId = tempId

      setPhotos((prev) => [...prev, { photoId: tempId, previewUrl, status: 'uploading' }])

      try {
        // Compress image client-side: resize to max 2048px, convert to WebP/JPEG
        let uploadBlob: Blob = file
        let uploadMime = normalizedMime
        try {
          const compressed = await compressImage(file)
          uploadBlob = compressed.blob
          uploadMime = compressed.mime
          if (isDev) console.log(`[Upload] Compressed ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${(uploadBlob.size / 1024).toFixed(0)}KB (${uploadMime})`)
        } catch (compressErr) {
          // Compression failed (e.g. HEIC on non-Safari browser) — try uploading original
          if (isDev) console.warn('[Upload] Client-side compression failed, using original:', compressErr)
          if (file.size > MAX_FILE_SIZE_BYTES) {
            throw new Error(`Deze foto is te groot (${(file.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB). Kies een kleinere foto of probeer een andere browser.`)
          }
        }

        // 1. Initiate
        if (isDev) console.log(`[Upload] Initiating upload for ${file.name} (${(uploadBlob.size / 1024).toFixed(1)}KB)`)
        const initRes = await fetch('/api/v1/photos/initiate-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ filename: file.name, contentType: uploadMime, size: uploadBlob.size }),
        })
        if (!initRes.ok) {
          const errorData = await initRes.json().catch(() => ({ error: 'onbekende fout' }))
          throw new Error(`Uploaden mislukt: ${errorData.error || initRes.statusText}`)
        }
        const { data: initData } = await initRes.json()
        realId = initData.photoId
        if (isDev) console.log(`[Upload] Got upload URL, uploading to MinIO...`)

        // 2. PUT directly to MinIO (preferred path)
        let uploaded = false
        const uploadStartTime = Date.now()
        if (shouldUseDirectBrowserUpload(initData.uploadUrl)) {
          try {
            const controller = new AbortController()
            const timeoutMs = Math.max(15000, uploadBlob.size / 50000 * 1000)
            const timeout = setTimeout(() => controller.abort(), timeoutMs)
            let putRes: Response
            try {
              putRes = await fetch(initData.uploadUrl, {
                method: 'PUT',
                body: uploadBlob,
                headers: { 'Content-Type': uploadMime },
                signal: controller.signal,
              })
            } finally {
              clearTimeout(timeout)
            }
            if (putRes.ok) {
              uploaded = true
            } else if (isDev) {
              console.warn(`[Upload] Direct MinIO upload failed: ${putRes.status} ${putRes.statusText}; trying fallback`)
            }
          } catch (directErr) {
            if (isDev) console.warn('[Upload] Direct MinIO upload blocked; trying fallback', directErr)
          }
        } else if (isDev) {
          console.log('[Upload] Same-origin upload detected; using fallback route')
        }

        // Fallback path: upload through same-origin API to avoid browser CORS/mixed-content issues.
        if (!uploaded) {
          const fallbackRes = await fetch(`/api/v1/photos/upload-fallback?photoId=${encodeURIComponent(initData.photoId)}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': uploadMime },
            body: uploadBlob,
          })
          if (!fallbackRes.ok) {
            const fallbackErr = await fallbackRes.json().catch(() => ({ error: fallbackRes.statusText }))
            throw new Error(`Uploaden mislukt: ${fallbackErr.error || fallbackRes.statusText}`)
          }
          uploaded = true
        }

        const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(1)
        if (isDev) console.log(`[Upload] Upload completed in ${uploadDuration}s, confirming...`)

        // 3. Confirm
        setPhotos((prev) => prev.map((p) => p.photoId === tempId ? { ...p, photoId: realId, status: 'confirming' } : p))

        const confirmRes = await fetch('/api/v1/photos/confirm-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ photoId: realId }),
        })
        if (!confirmRes.ok) {
          const errorData = await confirmRes.json().catch(() => ({ error: 'onbekende fout' }))
          throw new Error(`Foto verwerken mislukt: ${errorData.error || confirmRes.statusText}`)
        }
        if (isDev) console.log(`[Upload] ✓ ${file.name} uploaded successfully`)

        setPhotos((prev) =>
          prev.map((p) => p.photoId === tempId || p.photoId === realId
            ? { ...p, photoId: realId, status: 'ready' }
            : p,
          ),
        )
      } catch (err) {
        console.error(`[Upload] ✗ ${file.name} failed:`, err)
        const msg =
          err instanceof Error && /Failed to fetch|NetworkError|CORS|Mixed Content/i.test(err.message)
            ? 'De foto kwam niet aan. Controleer je internetverbinding en probeer het opnieuw.'
            : err instanceof Error
              ? err.message
              : 'Foto uploaden mislukt. Probeer het opnieuw.'
        setError(msg)
        // Match on both tempId and realId: before initiate-upload the photo still has tempId,
        // after it has realId. Using both ensures the error state is always set correctly.
        setPhotos((prev) => prev.map((p) => (p.photoId === tempId || p.photoId === realId) ? { ...p, status: 'error' } : p))
      }
    }
  }

  const handleSubmit = async () => {
    if (!isHalfStepRating(ratings.taste) || !isHalfStepRating(ratings.value) || !isHalfStepRating(ratings.portion)) {
      setError('Geef smaak, prijs-kwaliteit en portie een score van 1 tot 5 sterren.')
      return
    }
    if (ratings.service !== null && !isHalfStepRating(ratings.service)) {
      setError('Geef service een score van 1 tot 5 sterren, of kies "Geen score".')
      return
    }

    const readyPhotos = photos.filter((p) => p.status === 'ready')
    if (readyPhotos.length === 0) { setError('Voeg minstens één foto toe.'); return }
    if (text.trim().length < 10) { setError('Schrijf minstens 10 tekens over je ervaring.'); return }
    setError(null)
    setSubmitting(true)

    if (!pickedPlace) { setError('Kies eerst de snackplek.'); return }

    const payload = {
      ...(pickedPlace.placeId
        ? { placeId: pickedPlace.placeId }
        : { verifiedPlace: pickedPlace.verifiedPlace }),
      ratings,
      text: text.trim(),
      dishName: dishName.trim() || undefined,
      tags: selectedTags,
      photoIds: photos.filter((p) => p.status === 'ready').map((p) => p.photoId),
      mentionedUserIds,
    }

    try {
      const res = await fetch('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Plaatsen is niet gelukt. Probeer het opnieuw.'); return }
      // `posted=1` makes the review page open with the share prompt (see review/[id]/page.tsx).
      router.push(`/review/${json.data.id}?posted=1`)
    } catch (err) {
      setError('Er ging iets mis. Probeer het opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  const stepOrder: Step[] = ['photos', 'review', 'place']
  const currentStepIndex = stepOrder.indexOf(step)
  const readyPhotoCount = photos.filter((p) => p.status === 'ready').length
  const photosBusy = photos.some((p) => p.status === 'uploading' || p.status === 'confirming')
  const ratingsComplete =
    isHalfStepRating(ratings.taste) && isHalfStepRating(ratings.value) && isHalfStepRating(ratings.portion)
  const selectedPlaceSummary = pickedPlace ? (
    <div className="rounded-xl border border-snack-border bg-snack-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-snack-muted">Snackplek</p>
      <p className="mt-1 font-semibold text-snack-text">{pickedPlace.name}</p>
      {pickedPlace.address && <p className="mt-1 text-sm text-snack-muted">{pickedPlace.address}</p>}
    </div>
  ) : null

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-snack-text">Schrijf een review</h1>
        <p className="mt-1 text-sm text-snack-muted">
          In drie stappen: foto, beoordeling en snackplek. Je review is openbaar en helpt anderen
          kiezen waar en wat ze bestellen. <span className="font-semibold text-snack-primary">+75 XP</span>
        </p>
        <Link
          href="/add-bite"
          className="mt-2 inline-block text-xs text-snack-muted underline-offset-2 hover:text-snack-primary hover:underline"
        >
          Alleen vastleggen wat je at? Log een bite (24 uur zichtbaar) →
        </Link>
      </div>

      {/* Step indicators */}
      <div className="mb-8" aria-label="Stappen voor je review">
        <div className="flex items-center gap-2">
          {stepOrder.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                step === s ? 'bg-snack-primary text-white' : i < currentStepIndex ? 'bg-snack-accent text-snack-text' : 'bg-snack-surface text-snack-muted'
              }`}>
                {i + 1}
              </div>
              {i < 2 && <div className="h-0.5 w-8 flex-1 bg-snack-border" />}
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-snack-muted">
          <span className={step === 'photos' ? 'font-semibold text-snack-primary' : undefined}>Foto&apos;s</span>
          <span className={step === 'review' ? 'text-center font-semibold text-snack-primary' : 'text-center'}>Beoordeling</span>
          <span className={step === 'place' ? 'text-right font-semibold text-snack-primary' : 'text-right'}>Snackplek</span>
        </div>
      </div>

      {/* Place step: pick a verified venue (existing or provider-verified) */}
      {step === 'place' && (
        <div className="space-y-4">
          <PlacePicker
            accessToken={accessToken}
            value={pickedPlace}
            onChange={setPickedPlace}
          />

          {error && <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400" role="status" aria-live="polite">{error}</div>}

          <div className="flex gap-2">
            <button className="btn-secondary flex-1" type="button" onClick={() => { setError(null); setStep('review') }}>Terug</button>
            <button
              className="btn-primary flex-1"
              type="button"
              disabled={submitting}
              onClick={() => {
                if (!pickedPlace) {
                  setError('Kies een snackplek uit de lijst.'); return
                }
                setError(null)
                void handleSubmit()
              }}
            >
              {submitting ? 'Bezig met plaatsen…' : 'Review plaatsen'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 'review' && (
        <div className="space-y-4">
          {selectedPlaceSummary}
          <p className="text-sm text-snack-muted">Geef sterren voor smaak, prijs-kwaliteit en portie. Halve sterren kan ook: tik op de linkerhelft van een ster.</p>
          <div>
            <label className="label">Smaak *</label>
            <Stars value={ratings.taste} onChange={(value) => setRatings((prev) => ({ ...prev, taste: value }))} />
          </div>
          <div>
            <label className="label">Prijs-kwaliteit *</label>
            <Stars value={ratings.value} onChange={(value) => setRatings((prev) => ({ ...prev, value }))} />
          </div>
          <div>
            <label className="label">Portie *</label>
            <Stars value={ratings.portion} onChange={(value) => setRatings((prev) => ({ ...prev, portion: value }))} />
          </div>
          <div>
            <label className="label">Service (optioneel)</label>
            <div className="flex items-center gap-3">
              <Stars value={ratings.service ?? 0} onChange={(value) => setRatings((prev) => ({ ...prev, service: value }))} />
              <button
                type="button"
                className="btn-secondary text-xs py-1 px-2"
                onClick={() => setRatings((prev) => ({ ...prev, service: null }))}
              >
                Geen score
              </button>
            </div>
          </div>
          {ratingsComplete && (
            <div className="px-3 py-2 bg-snack-surface rounded-lg text-sm text-snack-text">
              Totaalscore: <span className="font-semibold">{computeOverallRating(ratings).toFixed(1).replace('.', ',')}</span>
            </div>
          )}
          <div>
            <label className="label">Gerecht</label>
            <input className="input" placeholder="Bijv. frikandel speciaal, kroket, kapsalon" value={dishName} onChange={(e) => setDishName(e.target.value)} maxLength={100} />
            <p className="mt-1 text-xs text-snack-muted">Wat heb je besteld? Met de naam van het gerecht vinden anderen je review als ze erop zoeken.</p>
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <label className="label mb-0">Tags</label>
              <span className="text-xs text-snack-muted">{selectedTags.length}/6</span>
            </div>
            <p className="mt-1 text-xs text-snack-muted">Kies er een paar die bij deze plek passen. Zo komt je review op de juiste plek in Ontdek.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {REVIEW_TAG_OPTIONS.map((option) => {
                const isActive = selectedTags.includes(option.value)

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setSelectedTags((prev) => {
                        if (prev.includes(option.value)) {
                          return prev.filter((tag) => tag !== option.value)
                        }
                        if (prev.length >= 6) {
                          return prev
                        }
                        return [...prev, option.value]
                      })
                    }}
                    className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                      isActive
                        ? 'border-snack-primary bg-snack-primary text-white'
                        : 'border-snack-border bg-snack-background text-snack-muted hover:border-snack-primary hover:text-snack-primary'
                    }`}
                    title={option.hint}
                    aria-pressed={isActive}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="label">Je review * <span className="text-snack-muted font-normal">({text.length}/2000)</span></label>
            <UserMentionInput
              value={text}
              onChange={(newText, mentionedIds) => {
                setText(newText)
                setMentionedUserIds(mentionedIds)
              }}
              placeholder="Wat was goed, wat minder? Noem iemand met @gebruikersnaam."
              className="input min-h-[140px] resize-none"
              maxLength={2000}
            />
            <p className="mt-2 text-xs text-snack-muted">Vertel wat je bestelde, hoe het smaakte en of je het zou aanraden. Minimaal 10 tekens.</p>
          </div>

          {error && <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400" role="status" aria-live="polite">{error}</div>}

          <div className="flex gap-2">
            <button className="btn-secondary flex-1" type="button" onClick={() => { setError(null); setStep('photos') }}>Terug</button>
            <button
              className="btn-primary flex-1"
              type="button"
              onClick={() => {
                if (!ratingsComplete) { setError('Geef eerst sterren voor smaak, prijs-kwaliteit en portie.'); return }
                if (text.trim().length < 10) { setError('Schrijf minstens 10 tekens over je ervaring.'); return }
                setError(null)
                setStep('place')
              }}
            >
              {pickedPlace ? 'Volgende: snackplek bevestigen' : 'Volgende: snackplek kiezen'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Photos */}
      {step === 'photos' && (
        <div className="space-y-4">
          {selectedPlaceSummary}
          <p className="text-sm text-snack-muted">Begin met een foto van je eten (1 tot 5 foto&apos;s). Zo zien anderen meteen wat ze kunnen verwachten.</p>

          <input
            id="review-photo-input"
            ref={fileInputRef}
            type="file"
            accept="image/*,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif"
            multiple
            className="sr-only"
            onChange={(e) => {
              void handleFileSelect(e.target.files)
              e.currentTarget.value = ''
            }}
          />

          {photos.length < 5 && (
            <label
              htmlFor="review-photo-input"
              className="btn-secondary block w-full cursor-pointer text-center"
            >
              Foto&apos;s toevoegen ({photos.length}/5)
            </label>
          )}

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <div key={p.photoId} className="relative aspect-square rounded-xl overflow-hidden bg-snack-surface">
                  {/* Scheme guard: only browser-generated blob: object URLs are
                      ever rendered as the preview source. */}
                  {p.previewUrl.startsWith('blob:') && (
                    <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                  )}
                  <div className={`absolute inset-0 flex items-center justify-center ${p.status !== 'ready' ? 'bg-black/40' : 'opacity-0'}`}>
                    {p.status === 'uploading' || p.status === 'confirming'
                      ? <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : p.status === 'error' && <span className="text-white text-sm font-semibold">Mislukt</span>
                    }
                  </div>
                  <button
                    type="button"
                    className="absolute top-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-sm text-white"
                    aria-label="Foto verwijderen"
                    onClick={() => {
                      revokePreviewUrl(p.previewUrl)
                      setPhotos((prev) => prev.filter((x) => x.photoId !== p.photoId))
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {photos.filter((p) => p.status === 'ready').length === 0 && photos.length > 0 && (
            <p className="text-xs text-snack-muted">Foto&apos;s worden geüpload…</p>
          )}

          {photos.length === 0 && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl text-center">
              <p className="text-sm text-blue-900 dark:text-blue-300 font-medium">Minstens één foto is verplicht</p>
            </div>
          )}

          {error && <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400" role="status" aria-live="polite">{error}</div>}

          <button
            className="btn-primary w-full"
            type="button"
            disabled={readyPhotoCount === 0 || photosBusy}
            onClick={() => { setError(null); setStep('review') }}
          >
            {photosBusy ? 'Bezig met uploaden…' : 'Volgende: beoordelen'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function AddReviewPage() {
  // useSearchParams requires a Suspense boundary during prerendering.
  return (
    <Suspense fallback={null}>
      <AddReviewForm />
    </Suspense>
  )
}
