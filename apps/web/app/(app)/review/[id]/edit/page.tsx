'use client'
import { use, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { photoVariantUrl } from '@/lib/photo-url'
import { computeOverallRating } from '@/lib/ratings'
import { REVIEW_TAG_OPTIONS, type ReviewTag } from '@/lib/review-tags'
import { shouldUseDirectBrowserUpload, normalizeUploadMime, compressImage } from '@/lib/upload'
import { AuthGate } from '@/components/auth-gate'

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
  tags?: ReviewTag[]
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
          {i < steps.length - 1 && <div className="flex-1 h-0.5 bg-snack-border w-8" />}
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
  const [selectedTags, setSelectedTags] = useState<ReviewTag[]>([])
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
          setError(json.error ?? 'Deze review bestaat niet (meer).')
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
        setSelectedTags(data.tags ?? [])
        const existingPhotos = data.reviewPhotos
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .reduce<UploadedPhoto[]>((acc, rp) => {
            const previewUrl = photoVariantUrl(rp.photo.variants as Record<string, string>, ['medium', 'thumb'])
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
        setError('Review laden is niet gelukt. Probeer het later opnieuw.')
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
        <Link href="/" className="btn-primary mt-4 inline-block">Naar home</Link>
      </div>
    )
  }

  if (!user || !accessToken) {
    return (
      <AuthGate
        title="Log in om je review te bewerken"
        body="Alleen de schrijver van een review kan hem aanpassen."
        returnTo={`/review/${id}/edit`}
      />
    )
  }

  if (!review || review.user.id !== user.id) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="font-semibold text-snack-text">Je kunt alleen je eigen reviews bewerken.</p>
        <Link href={reviewHref} className="btn-primary mt-4 inline-block">Terug naar review</Link>
      </div>
    )
  }

  const submit = async () => {
    if (!isHalfStepRating(ratings.taste) || !isHalfStepRating(ratings.value) || !isHalfStepRating(ratings.portion)) {
      setError('Geef smaak, prijs-kwaliteit en portie een score van 1 tot 5 sterren.')
      return
    }
    if (ratings.service !== null && !isHalfStepRating(ratings.service)) {
      setError('Geef service een score van 1 tot 5 sterren, of kies "Geen score".')
      return
    }
    if (text.trim().length < 10) {
      setError('Schrijf minstens 10 tekens over je ervaring.')
      return
    }
    if (photos.some((p) => p.status === 'uploading' || p.status === 'confirming')) {
      setError('Wacht tot alle foto\'s geüpload zijn.')
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
          tags: selectedTags,
          photoIds,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Opslaan is niet gelukt. Probeer het opnieuw.')
        return
      }

      router.push(reviewHref)
      router.refresh()
    } catch {
      setError('Opslaan is niet gelukt. Probeer het opnieuw.')
    } finally {
      setSaving(false)
    }
  }

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return
    if (!accessToken) {
      setError('Je sessie is nog niet klaar. Wacht even en probeer het opnieuw.')
      return
    }

    const remaining = MAX_PHOTOS - photos.length
    const toUpload = Array.from(files).slice(0, remaining)

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
        // Compress image client-side
        let uploadBlob: Blob = file
        let uploadMime = normalizedMime
        try {
          const compressed = await compressImage(file)
          uploadBlob = compressed.blob
          uploadMime = compressed.mime
        } catch {
          if (file.size > MAX_FILE_SIZE_BYTES) {
            throw new Error(`Deze foto is te groot (${(file.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB). Kies een kleinere foto of probeer een andere browser.`)
          }
        }

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

        let uploaded = false
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
            if (putRes.ok) uploaded = true
          } catch {
            // Ignore direct upload failures and use fallback.
          }
        }

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
        }

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

        setPhotos((prev) =>
          prev.map((p) => p.photoId === tempId || p.photoId === realId
            ? { ...p, photoId: realId, status: 'ready' }
            : p,
          ),
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Foto uploaden mislukt. Probeer het opnieuw.'
        setError(msg)
        setPhotos((prev) => prev.map((p) => (p.photoId === tempId || p.photoId === realId) ? { ...p, status: 'error' } : p))
      }
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-6 text-2xl font-heading font-bold text-snack-text">Review bewerken</h1>

      <StepIndicators step={step} />

      {step === 'place' && (
        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-sm text-snack-muted">Snackplek</p>
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
            Volgende: beoordeling
          </button>

          <Link href={reviewHref} className="btn-secondary block w-full text-center">
            Annuleren
          </Link>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <div>
            <label className="label">Smaak *</label>
            <Stars value={ratings.taste} onChange={(value) => setRatings((prev) => ({ ...prev, taste: value }))} />
          </div>

          <div>
            <label className="label">Prijs-kwaliteit *</label>
            <Stars value={ratings.value} onChange={(value) => setRatings((prev) => ({ ...prev, value: value }))} />
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
                className="btn-secondary px-2 py-1 text-xs"
                onClick={() => setRatings((prev) => ({ ...prev, service: null }))}
              >
                Geen score
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-snack-surface px-3 py-2 text-sm text-snack-text">
            Totaalscore: <span className="font-semibold">{computeOverallRating(ratings).toFixed(1).replace('.', ',')}</span>
          </div>

          <div>
            <label className="label">Gerecht</label>
            <input
              className="input"
              placeholder="Bijv. frikandel speciaal, kroket, kapsalon"
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label className="label mb-0">Tags</label>
              <span className="text-xs text-snack-muted">{selectedTags.length}/6</span>
            </div>
            <p className="mt-1 text-xs text-snack-muted">Kies tags die bij deze plek passen. Zo komt je review op de juiste plek in Ontdek.</p>
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
            <textarea
              className="input min-h-[140px] resize-none"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setStep('place')}>Terug</button>
            <button
              className="btn-primary flex-1"
              onClick={() => {
                if (text.trim().length < 10) {
                  setError('Schrijf minstens 10 tekens over je ervaring.')
                  return
                }
                setError(null)
                setStep('photos')
              }}
            >
              Volgende: foto&apos;s
            </button>
          </div>
        </div>
      )}

      {step === 'photos' && (
        <div className="space-y-4">
          <p className="text-sm text-snack-muted">Maximaal 5 foto&apos;s. Tik op × om een foto te verwijderen.</p>

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
              Foto&apos;s toevoegen ({photos.length}/{MAX_PHOTOS})
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
                      : p.status === 'error' && <span className="text-sm font-semibold text-white">Mislukt</span>
                    }
                  </div>
                  <button
                    type="button"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-xs text-white"
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

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setStep('review')}>Terug</button>
            <button
              className="btn-primary flex-1"
              onClick={submit}
              disabled={saving || photos.some((p) => p.status === 'uploading' || p.status === 'confirming')}
            >
              {saving ? 'Opslaan…' : 'Wijzigingen opslaan'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
