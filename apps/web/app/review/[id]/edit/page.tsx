'use client'
import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'

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
  user: { id: string; username: string }
  place: { id: string; name: string; address: string }
}

interface RatingDraft {
  taste: number
  value: number
  portion: number
  service: number | null
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
  const [saving, setSaving] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

    setSaving(true)
    setError(null)

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

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button className="btn-primary w-full" onClick={submit} disabled={saving}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}

