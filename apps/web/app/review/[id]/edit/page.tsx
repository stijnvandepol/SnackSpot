'use client'
import { use, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { photoVariantUrl } from '@/lib/photo-url'

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
  source: 'existing' | 'new'
}

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

function RatingPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {[1, 2, 3, 4, 5].map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
            value === r
              ? 'border-snack-primary bg-snack-surface text-snack-primary'
              : 'border-[#e4e4e4] text-snack-muted'
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

export default function EditReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user, accessToken, loading } = useAuth()

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
  const [saving, setSaving] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
              source: 'existing',
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
        <Link href={`/review/${id}`} className="btn-primary mt-4 inline-block">Back to Review</Link>
      </div>
    )
  }

  const submit = async () => {
    if (ratings.taste < 1 || ratings.taste > 5 || ratings.value < 1 || ratings.value > 5 || ratings.portion < 1 || ratings.portion > 5) {
      setError('Choose ratings from 1 to 5')
      return
    }
    if (ratings.service !== null && (ratings.service < 1 || ratings.service > 5)) {
      setError('Service rating must be between 1 and 5')
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

    const newPhotoIds = photos
      .filter((p) => p.source === 'new' && p.status === 'ready')
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
          photoIds: newPhotoIds,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Failed to save changes')
        return
      }

      router.push(`/review/${id}`)
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

      setPhotos((prev) => [...prev, { photoId: tempId, previewUrl, status: 'uploading', source: 'new' }])

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
    <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-heading font-bold text-snack-text">Edit Review</h1>
        <Link href={`/review/${id}`} className="btn-secondary text-sm">Cancel</Link>
      </div>

      <div className="card p-4">
        <p className="text-sm text-snack-muted">Place</p>
        <p className="font-semibold text-snack-text">{review.place.name}</p>
        <p className="text-xs text-snack-muted mt-1">{review.place.address}</p>
      </div>

      <div className="space-y-2">
        <label className="label">Taste</label>
        <RatingPicker value={ratings.taste} onChange={(v) => setRatings((prev) => ({ ...prev, taste: v }))} />
      </div>

      <div className="space-y-2">
        <label className="label">Value for money</label>
        <RatingPicker value={ratings.value} onChange={(v) => setRatings((prev) => ({ ...prev, value: v }))} />
      </div>

      <div className="space-y-2">
        <label className="label">Portion size</label>
        <RatingPicker value={ratings.portion} onChange={(v) => setRatings((prev) => ({ ...prev, portion: v }))} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="label">Service <span className="text-snack-muted font-normal">(optional)</span></label>
          <button
            type="button"
            className="text-xs text-snack-muted hover:text-snack-text"
            onClick={() => setRatings((prev) => ({ ...prev, service: null }))}
          >
            Clear
          </button>
        </div>
        <RatingPicker value={ratings.service ?? 0} onChange={(v) => setRatings((prev) => ({ ...prev, service: v }))} />
      </div>

      <div className="space-y-2">
        <label className="label">Dish name</label>
        <input
          className="input"
          value={dishName}
          onChange={(e) => setDishName(e.target.value)}
          placeholder="Optional dish name"
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <label className="label">
          Review text <span className="text-snack-muted font-normal">({text.length}/2000)</span>
        </label>
        <textarea
          className="input min-h-[160px] resize-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="label">Photos</label>
          <span className="text-xs text-snack-muted">{photos.length}/{MAX_PHOTOS}</span>
        </div>

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
            Add photos
          </label>
        )}

        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <div key={`${p.source}-${p.photoId}`} className="relative aspect-square overflow-hidden rounded-xl bg-snack-surface">
                <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                <div className={`absolute inset-0 flex items-center justify-center ${p.status !== 'ready' ? 'bg-black/40' : 'opacity-0'}`}>
                  {p.status === 'uploading' || p.status === 'confirming'
                    ? <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    : p.status === 'error' && <span className="text-sm font-semibold text-white">Error</span>
                  }
                </div>
                {p.source === 'new' && (
                  <button
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-xs text-white"
                    onClick={() => setPhotos((prev) => prev.filter((x) => x.photoId !== p.photoId))}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        className="btn-primary w-full"
        onClick={submit}
        disabled={saving || photos.some((p) => p.status === 'uploading' || p.status === 'confirming')}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}

