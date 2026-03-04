'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { ReviewCard } from '@/components/review-card'
import { useRouter } from 'next/navigation'

interface Review {
  id: string; rating: number; text: string; dishName?: string | null; createdAt: string; status: string
  user: { id: string; username: string; displayName?: string | null; avatarKey?: string | null; role: string }
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
        <p className="text-5xl mb-4">🔒</p>
        <p className="font-semibold text-gray-700">Log in to view your profile.</p>
        <a href="/auth/login" className="btn-primary mt-4 inline-block">Log in</a>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="card p-6 mb-6 flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-2xl uppercase flex-shrink-0">
          {(user.displayName ?? user.username)[0]}
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-xl text-gray-900">{user.displayName ?? user.username}</h1>
          <p className="text-sm text-gray-500">@{user.username}</p>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
            user.role === 'ADMIN' ? 'bg-red-100 text-red-700'
            : user.role === 'MODERATOR' ? 'bg-purple-100 text-purple-700'
            : 'bg-gray-100 text-gray-600'
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

      <h2 className="font-semibold text-lg text-gray-800 mb-4">My Reviews</h2>

      {loading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card h-32 animate-pulse bg-gray-100" />
          ))}
        </div>
      )}

      {!loading && reviews.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">📝</p>
          <p className="text-gray-500 text-sm">You haven't written any reviews yet.</p>
          <a href="/add-review" className="btn-primary mt-4 inline-block">Add your first review</a>
        </div>
      )}

      <div className="space-y-4">
        {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
      </div>
    </div>
  )
}
