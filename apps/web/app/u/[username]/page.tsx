'use client'
import { use, useEffect, useState } from 'react'
import { ReviewCard } from '@/components/review-card'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { TopNav } from '@/components/top-nav'
import { BottomNav } from '@/components/bottom-nav'

interface UserProfile {
  id: string
  username: string
  avatarKey: string | null
  role: string
  createdAt: string
  _count: { reviews: number; favorites: number }
}

interface Review {
  id: string
  rating: number
  text: string
  dishName?: string | null
  createdAt: string
  status: string
  likeCount?: number
  likedByMe?: boolean
  user: { id: string; username: string; avatarKey?: string | null; role: string }
  place: { id: string; name: string; address: string }
  reviewPhotos: Array<{ photo: { id: string; variants: Record<string, string> } }>
}

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  const { accessToken } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/v1/users/${encodeURIComponent(username)}`),
      fetch(`/api/v1/users/${encodeURIComponent(username)}/reviews?limit=50`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      }),
    ])
      .then(async ([profileRes, reviewsRes]) => {
        const profileJson = await profileRes.json()
        const reviewsJson = await reviewsRes.json()

        if (!profileRes.ok) {
          setError(profileJson.error ?? 'User not found')
          return
        }

        setProfile(profileJson.data)
        setReviews(reviewsJson.data?.data ?? [])
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [username, accessToken])

  if (error) return (
    <div className="flex min-h-full flex-col">
      <TopNav />
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="font-semibold text-snack-text">{error}</p>
        <Link href="/feed" className="btn-primary mt-4 inline-block">Back to Feed</Link>
      </div>
      <BottomNav />
    </div>
  )

  return (
    <div className="flex min-h-full flex-col">
      <TopNav />
      <main className="flex-1 pb-nav md:pb-0">
        <div className="mx-auto max-w-2xl px-4 py-6">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-20 bg-snack-surface rounded-2xl" />
            </div>
          ) : (
            profile ? (
              <>
                <div className="card p-6 mb-6 flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-snack-surface flex items-center justify-center text-snack-primary font-bold text-2xl uppercase flex-shrink-0">
                    {profile.username[0]}
                  </div>
                  <div>
                    <h1 className="font-heading font-bold text-xl text-snack-text">{profile.username}</h1>
                    <p className="text-sm text-snack-muted">@{profile.username}</p>
                    <p className="text-xs text-snack-muted mt-1">{profile._count.reviews} reviews</p>
                  </div>
                </div>

                <h2 className="font-heading font-semibold text-snack-text mb-4">Reviews</h2>
                {reviews.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-snack-muted text-sm">No reviews yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((r) => <ReviewCard key={r.id} review={r} backContext={`user:${username}`} />)}
                  </div>
                )}
              </>
            ) : null
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
