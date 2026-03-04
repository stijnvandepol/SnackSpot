'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { ReviewCard } from '@/components/review-card'
import { useRouter } from 'next/navigation'

interface Review {
  id: string; rating: number; text: string; dishName?: string | null; createdAt: string; status: string
  user: { id: string; username: string; avatarKey?: string | null; role: string }
  place: { id: string; name: string; address: string }
  reviewPhotos: Array<{ photo: { id: string; variants: Record<string, string> } }>
}

export default function ProfilePage() {
  const { user, accessToken, logout } = useAuth()
  const router = useRouter()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || !accessToken) return
    setLoading(true)
    fetch(`/api/v1/feed?limit=20`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((json) => setReviews((json.data?.data ?? []).filter((r: Review) => r.user.id === user.id)))
      .finally(() => setLoading(false))
  }, [user, accessToken])

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-semibold text-snack-text">Log in to view your profile.</p>
        <a href="/auth/login" className="btn-primary mt-4 inline-block">Log in</a>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="card p-6 mb-4 flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-snack-surface flex items-center justify-center text-snack-primary font-bold text-2xl uppercase flex-shrink-0">
          {user.username[0]}
        </div>
        <div className="min-w-0">
          <h1 className="font-heading font-bold text-xl text-snack-text">{user.username}</h1>
          <p className="text-sm text-snack-muted">@{user.username}</p>
          <p className="text-xs text-snack-muted mt-1">Snack hunter & reviewer</p>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
            user.role === 'ADMIN' ? 'bg-red-100 text-red-700'
            : user.role === 'MODERATOR' ? 'bg-purple-100 text-purple-700'
            : 'bg-snack-surface text-snack-muted'
          }`}>
            {user.role}
          </span>
        </div>
        <div className="ml-auto">
          <button
            onClick={async () => { await logout(); router.push('/auth/login') }}
            className="btn-secondary text-sm"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-snack-text">{reviews.length}</p>
          <p className="text-xs text-snack-muted">Posts</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-snack-text">0</p>
          <p className="text-xs text-snack-muted">Liked</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-snack-text">{reviews.length >= 5 ? 1 : 0}</p>
          <p className="text-xs text-snack-muted">Badges</p>
        </div>
      </div>

      <h2 className="font-heading font-semibold text-lg text-snack-text mb-4">My Posts</h2>

      {loading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card h-32 animate-pulse bg-snack-surface" />
          ))}
        </div>
      )}

      {!loading && reviews.length === 0 && (
        <div className="text-center py-12">
          <p className="text-snack-muted text-sm">You haven't written any reviews yet.</p>
          <a href="/add-review" className="btn-primary mt-4 inline-block">Add your first review</a>
        </div>
      )}

      <div className="space-y-4">
        {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
      </div>
    </div>
  )
}
