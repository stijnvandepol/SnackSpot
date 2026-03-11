'use client'
import { useState } from 'react'
import { useAuth } from '@/components/auth-provider'

interface ReviewLikeButtonProps {
  reviewId: string
  initialLikeCount: number
  initialLikedByMe: boolean
  className?: string
}

export function ReviewLikeButton({
  reviewId,
  initialLikeCount,
  initialLikedByMe,
  className,
}: ReviewLikeButtonProps) {
  const { accessToken } = useAuth()
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [likedByMe, setLikedByMe] = useState(initialLikedByMe)
  const [loading, setLoading] = useState(false)

  const toggleLike = async () => {
    if (!accessToken || loading) return

    const nextLiked = !likedByMe
    const nextCount = Math.max(0, likeCount + (nextLiked ? 1 : -1))

    setLikedByMe(nextLiked)
    setLikeCount(nextCount)
    setLoading(true)

    try {
      const res = await fetch(`/api/v1/reviews/${reviewId}/like`, {
        method: nextLiked ? 'POST' : 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!res.ok) throw new Error('Like request failed')

      const json = await res.json()
      const data = json.data as { likeCount: number; likedByMe: boolean }
      setLikeCount(data.likeCount)
      setLikedByMe(data.likedByMe)
    } catch {
      setLikedByMe((prev: boolean) => !prev)
      setLikeCount((prev: number) => Math.max(0, prev + (nextLiked ? -1 : 1)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggleLike}
      disabled={loading || !accessToken}
      className={`inline-flex items-center gap-1 text-sm ${likedByMe ? 'text-rose-600' : 'text-snack-muted'} ${!accessToken ? 'opacity-60 cursor-not-allowed' : ''} ${className ?? ''}`}
      aria-label={likedByMe ? 'Unlike post' : 'Like post'}
      aria-pressed={likedByMe}
      title={accessToken ? (likedByMe ? 'Unlike' : 'Like') : 'Log in to like'}
    >
      <span aria-hidden="true">{likedByMe ? '♥' : '♡'}</span>
      <span>{likeCount}</span>
    </button>
  )
}
