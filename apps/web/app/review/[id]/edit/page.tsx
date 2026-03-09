'use client'
import { use, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { photoVariantUrl } from '@/lib/photo-url'
import { shouldUseDirectBrowserUpload } from '@/lib/upload'

interface ReviewEditData {
  id: string
  rating: number
  ratings?: {
    taste: number
    value: number
    portion: number
    service: number | null
  }
  overallRating?: number
  text: string
  dishName?: string | null
  reviewPhotos: Array<{ sortOrder: number; photo: { id: string; variants: Record<string, string> } }>
  user: { id: string; username: string }
  place: { id: string; name: string; address: string }
}

interface RatingDraft {
  taste: number
  value: number
  portion: number
  service: number | null
}

interface UploadedPhoto {
  photoId: string
  previewUrl: string
  status: 'uploading' | 'confirming' | 'ready' | 'error'
}

type Step = 'place' | 'review' | 'photos'

const MAX_PHOTOS = 5

const MIME_ALIASES: Record<string, 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' | 'image/heic'> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-jpeg': 'image/jpeg',
  'image/jfif': 'image/jpeg',
  'image/png': 'image/png',
  'image/x-png': 'image/png',
  'image/webp': 'image/webp',
  'image/avif': 'image/avif',
  'image/heic': 'image/heic',
  'image/heif': 'image/heic',
  'image/heic-sequence': 'image/heic',
  'image/heif-sequence': 'image/heic',
}

function normalizeUploadMime(file: File): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' | 'image/heic' | null {
  const rawType = (file.type || '').trim().toLowerCase()
  if (rawType in MIME_ALIASES) return MIME_ALIASES[rawType]

  const name = (file.name || '').toLowerCase()
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.avif')) return 'image/avif'
  if (name.endsWith('.heic') || name.endsWith('.heif')) return 'image/heic'

  return null
}

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

function computeOverall(ratings: RatingDraft): number {
  const values = [ratings.taste, ratings.value, ratings.portion]
  if (typeof ratings.service === 'number') values.push(ratings.service)
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

function StepIndicators({ step }: { step: Step }) {
  const steps: Step[] = ['place', 'review', 'photos']

  return (
    <div className="mb-8 flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
            step === s
              ? 'bg-snack-primary text-white'
              : i < steps.indexOf(step)
                ? 'bg-snack-accent text-snack-text'
                : 'bg-snack-surface text-snack-muted'
          }`}>
            {i + 1}
          </div>
          {i < steps.length - 1 && <div className="flex-1 h-0.5 bg-[#e6e6e6] w-8" />}
        </div>
      ))}
    </div>
  )
}

export default function EditReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, accessToken, loading } = useAuth()
  const from = searchParams.get('from')
  const reviewHref = from
    ? `/review/${id}?from=${encodeURIComponent(from)}`
    : `/review/${id}`

  const [review, setReview] = useState<ReviewEditData | null>(null)
  const [ratings, setRatings] = useState<RatingDraft>({
    taste: 3,
    value: 3,
    portion: 3,
    service: null,
  })
  const [dishName, setDishName] = useState('')
  const [text, setText] = useState('')
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [step, setStep] = useState<Step>('place')
  const [saving, setSaving] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photosRef = useRef<UploadedPhoto[]>([])

  const revokePreviewUrl = (url: string) => {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  }

  useEffect(() => {
    fetch(`/api/v1/reviews/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.data) {
          setError(json.error ?? 'Review not found')
          setPageLoading(false)
          return
        }

        const data = json.data as ReviewEditData
        setReview(data)
        setRatings({
          taste: data.ratings?.taste ?? data.rating,
          value: data.ratings?.value ?? data.rating,
          portion: data.ratings?.portion ?? data.rating,
          service: data.ratings?.service ?? null,
        })
        setDishName(data.dishName ?? '')
        setText(data.text)
        const existingPhotos = data.reviewPhotos
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .reduce<UploadedPhoto[]>((acc, rp) => {
            const previewUrl = photoVariantUrl(rp.photo.variants, ['medium', 'thumb'])
            if (!previewUrl) return acc

            acc.push({
              photoId: rp.photo.id,
              previewUrl,
              status: 'ready',
            })
            return acc
          }, [])

        setPhotos(existingPhotos)
        setPageLoading(false)
      })
      .catch(() => {
        setError('Failed to load review')
        setPageLoading(false)
      })
  }, [id])

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => revokePreviewUrl(photo.previewUrl))
    }
  }, [])

  if (loading || pageLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6 animate-pulse space-y-4">
        <div className="h-8 w-1/2 rounded-xl bg-snack-surface" />
        <div className="h-12 rounded-xl bg-snack-surface" />
        <div className="h-40 rounded-xl bg-snack-surface" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="font-semibold text-snack-text">{error}</p>
        <Link href="/feed" className="btn-primary mt-4 inline-block">Back to Feed</Link>
      </div>
    )
  }

  if (!user || !accessToken) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="font-semibold text-snack-text">Please log in to edit your review.</p>
        <Link href="/auth/login" className="btn-primary mt-4 inline-block">Log in</Link>
      </div>
    )
  }

  if (!review || review.user.id !== user.id) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="font-semibold text-snack-text">You can only edit your own review.</p>
        <Link href={reviewHref} className="btn-primary mt-4 inline-block">Back to Review</Link>
      </div>
    )
  }

  const submit = async () => {
    if (!isHalfStepRating(ratings.taste) || !isHalfStepRating(ratings.value) || !isHalfStepRating(ratings.portion)) {
      setError('Choose ratings from 1 to 5 in steps of 0.5')
      return
    }
    if (ratings.service !== null && !isHalfStepRating(ratings.service)) {
      setError('Service rating must be between 1 and 5 in steps of 0.5')
      return
    }
    if (text.trim().length < 10) {
      setError('Review text must be at least 10 characters')
      return
    }
    if (photos.some((p) => p.status === 'uploading' || p.status === 'confirming')) {
      setError('Please wait until photo uploads are finished')
      return
    }

    setSaving(true)
    setError(null)

    const photoIds = photos
      .filter((p) => p.status === 'ready')
      .map((p) => p.photoId)

    try {
      const res = await fetch(`/api/v1/reviews/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ratings,
          text: text.trim(),
          dishName: dishName.trim() || undefined,
          photoIds,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Failed to save changes')
        return
      }

      router.push(reviewHref)
      router.refresh()
    } catch {
      setError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return
    if (!accessToken) {
      setError('Your session is not ready yet. Please wait a moment and try again.')
      return
    }

    const remaining = MAX_PHOTOS - photos.length
    const toUpload = Array.from(files).slice(0, remaining)

    for (const file of toUpload) {
      const normalizedMime = normalizeUploadMime(file)
      if (!normalizedMime) {
        setError(`Unsupported image type for ${file.name || 'selected file'}. Use JPG, PNG, WEBP, AVIF or HEIC.`)
        continue
      }

      const previewUrl = URL.createObjectURL(file)
      const tempId = createTempPhotoId()
      let realId = tempId

      setPhotos((prev) => [...prev, { photoId: tempId, previewUrl, status: 'uploading' }])

      try {
        const initRes = await fetch('/api/v1/photos/initiate-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ filename: file.name, contentType: normalizedMime, size: file.size }),
        })
        if (!initRes.ok) {
          const errorData = await initRes.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(`Initiate failed: ${errorData.error || initRes.statusText}`)
        }

        const { data: initData } = await initRes.json()
        realId = initData.photoId

        let uploaded = false
        if (shouldUseDirectBrowserUpload(initData.uploadUrl)) {
          try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 5000)
            let putRes: Response
            try {
              putRes = await fetch(initData.uploadUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': normalizedMime },
                signal: controller.signal,
              })
            } finally {
              clearTimeout(timeout)
            }
            if (putRes.ok) uploaded = true
          } catch {
            // Ignore direct upload failures and use fallback.
          }
        }

        if (!uploaded) {
          const fallbackRes = await fetch(`/api/v1/photos/upload-fallback?photoId=${encodeURIComponent(initData.photoId)}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': normalizedMime },
            body: file,
          })
          if (!fallbackRes.ok) {
            const fallbackErr = await fallbackRes.json().catch(() => ({ error: fallbackRes.statusText }))
            throw new Error(`Upload fallback failed: ${fallbackErr.error || fallbackRes.statusText}`)
          }
        }

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

        setPhotos((prev) =>
          prev.map((p) => p.photoId === tempId || p.photoId === realId
            ? { ...p, photoId: realId, status: 'ready' }
            : p,
          ),
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Photo upload failed'
        setError(msg)
        setPhotos((prev) => prev.map((p) => (p.photoId === tempId || p.photoId === realId) ? { ...p, status: 'error' } : p))
      }
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-6 text-2xl font-heading font-bold text-snack-text">Edit Post</h1>

      <StepIndicators step={step} />

      {step === 'place' && (
        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-sm text-snack-muted">Place</p>
            <p className="font-semibold text-snack-text">{review.place.name}</p>
            <p className="mt-1 text-xs text-snack-muted">{review.place.address}</p>
          </div>

          <button
            className="btn-primary mt-2 w-full"
            onClick={() => {
              setError(null)
              setStep('review')
            }}
          >
            Next: Write Review -&gt;
          </button>

          <Link href={reviewHref} className="btn-secondary block w-full text-center">
            Cancel
          </Link>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <div>
            <label className="label">Taste *</label>
            <Stars value={ratings.taste} onChange={(value) => setRatings((prev) => ({ ...prev, taste: value }))} />
          </div>

          <div>
            <label className="label">Value / Price *</label>
            <Stars value={ratings.value} onChange={(value) => setRatings((prev) => ({ ...prev, value: value }))} />
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
                className="btn-secondary px-2 py-1 text-xs"
                onClick={() => setRatings((prev) => ({ ...prev, service: null }))}
              >
                Not set
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-snack-surface px-3 py-2 text-sm text-snack-text">
            Overall rating: <span className="font-semibold">{computeOverall(ratings).toFixed(1)}</span>
          </div>

          <div>
            <label className="label">Dish name</label>
            <input
              className="input"
              placeholder="e.g. Stroopwafel, Currywurst"
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div>
            <label className="label">Your review * <span className="text-snack-muted font-normal">({text.length}/2000)</span></label>
            <textarea
              className="input min-h-[140px] resize-none"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setStep('place')}>{"<- Back"}</button>
            <button
              className="btn-primary flex-1"
              onClick={() => {
                if (text.trim().length < 10) {
                  setError('Review text must be at least 10 characters')
                  return
                }
                setError(null)
                setStep('photos')
              }}
            >
              Next: Add Photos -&gt;
            </button>
          </div>
        </div>
      )}

      {step === 'photos' && (
        <div className="space-y-4">
          <p className="text-sm text-snack-muted">Add up to 5 photos (optional). Remove any photo with x.</p>

          <input
            id="edit-review-photo-input"
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

          {photos.length < MAX_PHOTOS && (
            <label
              htmlFor="edit-review-photo-input"
              className="btn-secondary block w-full cursor-pointer text-center"
            >
              Add photos ({photos.length}/{MAX_PHOTOS})
            </label>
          )}

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <div key={p.photoId} className="relative aspect-square overflow-hidden rounded-xl bg-snack-surface">
                  <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                  <div className={`absolute inset-0 flex items-center justify-center ${p.status !== 'ready' ? 'bg-black/40' : 'opacity-0'}`}>
                    {p.status === 'uploading' || p.status === 'confirming'
                      ? <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      : p.status === 'error' && <span className="text-sm font-semibold text-white">Error</span>
                    }
                  </div>
                  <button
                    type="button"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-xs text-white"
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

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setStep('review')}>{"<- Back"}</button>
            <button
              className="btn-primary flex-1"
              onClick={submit}
              disabled={saving || photos.some((p) => p.status === 'uploading' || p.status === 'confirming')}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
