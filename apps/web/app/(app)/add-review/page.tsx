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
            aria-label={`Set ${s - 0.5} stars`}
            onClick={() => onChange(s - 0.5)}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 z-10 w-1/2"
            aria-label={`Set ${s} stars`}
            onClick={() => onChange(s)}
          />
          <span
            className={`pointer-events-none text-4xl ${
              value >= s ? 'text-snack-rating' : value === s - 0.5 ? 'text-snack-rating/60' : 'text-[#dfdfdf]'
            }`}
          >
            ★
          </span>
        </div>
      ))}
      {value >= 1 && <span className="ml-2 text-sm font-semibold text-snack-text">{value.toFixed(1)}</span>}
    </div>
  )
}

function AddReviewForm() {
  const { user, accessToken, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillPlaceId = searchParams.get('placeId')
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

  if (loading) return null

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-semibold text-snack-text">Please log in to add a review.</p>
        <a href="/auth/login" className="btn-primary mt-4 inline-block">Log in</a>
      </div>
    )
  }

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return
    if (!accessToken) {
      setError('Your session is not ready yet. Please wait a moment and try again.')
      return
    }
    const remaining = 5 - photos.length
    const toUpload = Array.from(files).slice(0, remaining)

    // Upload sequentially for better reliability on mobile browsers.
    for (const file of toUpload) {
      const normalizedMime = normalizeUploadMime(file)
      if (!normalizedMime) {
        setError(`Unsupported image type for ${file.name || 'selected file'}. Use JPG, PNG, WEBP, AVIF or HEIC.`)
        continue
      }

      if (file.size > MAX_FILE_SIZE_BYTES * 2) {
        setError(`${file.name || 'File'} is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB before compression.`)
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
            throw new Error(`Photo is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Try a smaller photo or use a different browser.`)
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
          const errorData = await initRes.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(`Initiate failed: ${errorData.error || initRes.statusText}`)
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
            throw new Error(`Upload fallback failed: ${fallbackErr.error || fallbackRes.statusText}`)
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
          const errorData = await confirmRes.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(`Confirm failed: ${errorData.error || confirmRes.statusText}`)
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
            ? 'Upload blocked before reaching the server. Check the upload proxy/network path.'
            : err instanceof Error
              ? err.message
              : 'Photo upload failed'
        setError(msg)
        // Match on both tempId and realId: before initiate-upload the photo still has tempId,
        // after it has realId. Using both ensures the error state is always set correctly.
        setPhotos((prev) => prev.map((p) => (p.photoId === tempId || p.photoId === realId) ? { ...p, status: 'error' } : p))
      }
    }
  }

  const handleSubmit = async () => {
    if (!isHalfStepRating(ratings.taste) || !isHalfStepRating(ratings.value) || !isHalfStepRating(ratings.portion)) {
      setError('Choose ratings from 1 to 5 in steps of 0.5')
      return
    }
    if (ratings.service !== null && !isHalfStepRating(ratings.service)) {
      setError('Service rating must be between 1 and 5 in steps of 0.5')
      return
    }

    const readyPhotos = photos.filter((p) => p.status === 'ready')
    if (readyPhotos.length === 0) { setError('At least one photo is required'); return }
    if (text.trim().length < 10) { setError('Review text must be at least 10 characters'); return }
    setError(null)
    setSubmitting(true)

    if (!pickedPlace) { setError('Pick a place first'); return }

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
      if (!res.ok) { setError(json.error ?? 'Failed to submit review'); return }
      router.push(`/review/${json.data.id}`)
    } catch (err) {
      setError('Something went wrong. Please try again.')
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
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-snack-muted">Place</p>
      <p className="mt-1 font-semibold text-snack-text">{pickedPlace.name}</p>
      {pickedPlace.address && <p className="mt-1 text-sm text-snack-muted">{pickedPlace.address}</p>}
    </div>
  ) : null

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-snack-text">Write a review</h1>
        <p className="mt-1 text-sm text-snack-muted">
          Public and permanent: your photo, the dish and your ratings put this spot on the map
          for everyone. <span className="font-semibold text-snack-primary">+75 XP</span>
        </p>
        <Link
          href="/add-bite"
          className="mt-2 inline-block text-xs text-snack-muted underline-offset-2 hover:text-snack-primary hover:underline"
        >
          Just logging your meal? Log a bite (24h) →
        </Link>
      </div>

      {/* Step indicators */}
      <div className="mb-8" aria-label="Create post progress">
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
          <span className={step === 'photos' ? 'font-semibold text-snack-primary' : undefined}>Photos</span>
          <span className={step === 'review' ? 'text-center font-semibold text-snack-primary' : 'text-center'}>Review</span>
          <span className={step === 'place' ? 'text-right font-semibold text-snack-primary' : 'text-right'}>Place</span>
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
            <button className="btn-secondary flex-1" type="button" onClick={() => { setError(null); setStep('review') }}>Back</button>
            <button
              className="btn-primary flex-1"
              type="button"
              disabled={submitting}
              onClick={() => {
                if (!pickedPlace) {
                  setError('Pick a place from the list'); return
                }
                setError(null)
                void handleSubmit()
              }}
            >
              {submitting ? 'Submitting...' : 'Submit review'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 'review' && (
        <div className="space-y-4">
          {selectedPlaceSummary}
          <div>
            <label className="label">Taste *</label>
            <Stars value={ratings.taste} onChange={(value) => setRatings((prev) => ({ ...prev, taste: value }))} />
          </div>
          <div>
            <label className="label">Value / Price *</label>
            <Stars value={ratings.value} onChange={(value) => setRatings((prev) => ({ ...prev, value }))} />
          </div>
          <div>
            <label className="label">Portion *</label>
            <Stars value={ratings.portion} onChange={(value) => setRatings((prev) => ({ ...prev, portion: value }))} />
          </div>
          <div>
            <label className="label">Service (optional)</label>
            <div className="flex items-center gap-3">
              <Stars value={ratings.service ?? 0} onChange={(value) => setRatings((prev) => ({ ...prev, service: value }))} />
              <button
                type="button"
                className="btn-secondary text-xs py-1 px-2"
                onClick={() => setRatings((prev) => ({ ...prev, service: null }))}
              >
                Not set
              </button>
            </div>
          </div>
          {ratingsComplete && (
            <div className="px-3 py-2 bg-snack-surface rounded-lg text-sm text-snack-text">
              Overall rating: <span className="font-semibold">{computeOverallRating(ratings).toFixed(1)}</span>
            </div>
          )}
          <div>
            <label className="label">Dish name</label>
            <input className="input" placeholder="e.g. Stroopwafel, Herring" value={dishName} onChange={(e) => setDishName(e.target.value)} maxLength={100} />
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <label className="label mb-0">Post tags</label>
              <span className="text-xs text-snack-muted">{selectedTags.length}/6</span>
            </div>
            <p className="mt-1 text-xs text-snack-muted">Add a few tags so Explore can surface the right kind of spot.</p>
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
            <label className="label">Your review * <span className="text-snack-muted font-normal">({text.length}/2000)</span></label>
            <UserMentionInput
              value={text}
              onChange={(newText, mentionedIds) => {
                setText(newText)
                setMentionedUserIds(mentionedIds)
              }}
              placeholder="Tell people what you loved (or didn't)… Use @username to mention someone"
              className="input min-h-[140px] resize-none"
              maxLength={2000}
            />
            <p className="mt-2 text-xs text-snack-muted">Share the standout details: what you ordered, how it tasted, and whether you would recommend it.</p>
          </div>

          {error && <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400" role="status" aria-live="polite">{error}</div>}

          <div className="flex gap-2">
            <button className="btn-secondary flex-1" type="button" onClick={() => { setError(null); setStep('photos') }}>Back</button>
            <button
              className="btn-primary flex-1"
              type="button"
              onClick={() => {
                if (!ratingsComplete) { setError('Rate taste, value and portion before continuing'); return }
                if (text.trim().length < 10) { setError('Review text must be at least 10 characters'); return }
                setError(null)
                setStep('place')
              }}
            >
              {pickedPlace ? 'Next: Confirm place' : 'Next: Choose place'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Photos */}
      {step === 'photos' && (
        <div className="space-y-4">
          {selectedPlaceSummary}
          <p className="text-sm text-snack-muted">Start with the food: add 1 to 5 photos of what you&apos;re eating.</p>

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
              Add photos ({photos.length}/5)
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
                      : p.status === 'error' && <span className="text-white text-sm font-semibold">Error</span>
                    }
                  </div>
                  <button
                    type="button"
                    className="absolute top-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-sm text-white"
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
            <p className="text-xs text-snack-muted">Waiting for photos to upload...</p>
          )}

          {photos.length === 0 && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl text-center">
              <p className="text-sm text-blue-900 dark:text-blue-300 font-medium">At least one photo is required</p>
            </div>
          )}

          {error && <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400" role="status" aria-live="polite">{error}</div>}

          <button
            className="btn-primary w-full"
            type="button"
            disabled={readyPhotoCount === 0 || photosBusy}
            onClick={() => { setError(null); setStep('review') }}
          >
            {photosBusy ? 'Uploading...' : 'Next: Rate & write'}
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
