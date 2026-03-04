'use client'
import { use, useEffect, useState } from 'react'
import { ReviewCard } from '@/components/review-card'
import Link from 'next/link'

interface UserProfile {
  id: string; username: string; displayName: string | null; avatarKey: string | null; role: string; createdAt: string
  _count: { reviews: number; favorites: number }
}

interface Review {
  id: string; rating: number; text: string; dishName?: string | null; createdAt: string; status: string
  user: { id: string; username: string; displayName?: string | null; avatarKey?: string | null; role: string }
  place: { id: string; name: string; address: string }
  reviewPhotos: Array<{ photo: { id: string; variants: Record<string, string> } }>
}

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch user via feed and filter – in a real app there'd be a /api/v1/users/:username endpoint
    setLoading(true)
    fetch(`/api/v1/feed?limit=50`)
      .then((r) => r.json())
      .then((json) => {
        const feedReviews: Review[] = json.data?.data ?? []
        const userReviews = feedReviews.filter((r) => r.user.username === username)
        if (userReviews.length === 0 && feedReviews.length > 0) {
          setError('User not found')
        } else if (userReviews.length > 0) {
          const u = userReviews[0].user
          setProfile({ id: u.id, username: u.username, displayName: u.displayName ?? null, avatarKey: u.avatarKey ?? null, role: u.role, createdAt: '', _count: { reviews: userReviews.length, favorites: 0 } })
          setReviews(userReviews)
        }
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [username])

  if (error) return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-5xl mb-4">😕</p>
      <p className="font-semibold text-gray-700">{error}</p>
      <Link href="/feed" className="btn-primary mt-4 inline-block">Back to Feed</Link>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-100 rounded-2xl" />
        </div>
      ) : profile ? (
        <>
          <div className="card p-6 mb-6 flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-2xl uppercase flex-shrink-0">
              {(profile.displayName ?? profile.username)[0]}
            </div>
            <div>
              <h1 className="font-bold text-xl text-gray-900">{profile.displayName ?? profile.username}</h1>
              <p className="text-sm text-gray-500">@{profile.username}</p>
              <p className="text-xs text-gray-400 mt-1">{reviews.length} reviews</p>
            </div>
          </div>

          <h2 className="font-semibold text-gray-800 mb-4">Reviews</h2>
          {reviews.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📝</p>
              <p className="text-gray-500 text-sm">No reviews yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
