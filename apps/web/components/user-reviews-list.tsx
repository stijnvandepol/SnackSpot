'use client'
import { useEffect, useState } from 'react'
import { ReviewCard } from '@/components/review-card'
import { useAuth } from '@/components/auth-provider'

interface Review {
  id: string
  rating: number
  text: string
  dishName?: string | null
  createdAt: string
  status: string
  likeCount?: number
  likedByMe?: boolean
  overallRating?: number
  user: { id: string; username: string; avatarKey?: string | null; role: string }
  place: { id: string; name: string; address: string }
  reviewPhotos: Array<{ photo: { id: string; variants: Record<string, string> } }>
}

interface UserReviewsListProps {
  username: string
}

export function UserReviewsList({ username }: UserReviewsListProps) {
  const { accessToken } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/v1/users/${encodeURIComponent(username)}/reviews?limit=50`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
      .then((r) => r.json())
      .then((json) => setReviews(json.data?.data ?? []))
      .catch(() => setError('Could not load reviews.'))
      .finally(() => setLoading(false))
  }, [username, accessToken])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => <div key={i} className="card h-32 bg-snack-surface" />)}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-snack-muted">{error}</p>
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-snack-muted text-sm">No reviews yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {reviews.map((r) => (
        <ReviewCard
          key={r.id}
          review={r}
          photoVariantPreference={['large', 'medium', 'thumb']}
          backContext={`user:${username}`}
        />
      ))}
    </div>
  )
}
