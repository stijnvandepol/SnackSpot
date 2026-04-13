'use client'
import { useState } from 'react'
import { useAuthOptional } from '@/components/auth-provider'

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
  const accessToken = useAuthOptional()?.accessToken ?? null
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [likedByMe, setLikedByMe] = useState(initialLikedByMe)
  const [loading, setLoading] = useState(false)
  const [pop, setPop] = useState(false)

  const toggleLike = async () => {
    if (!accessToken || loading) return

    const nextLiked = !likedByMe
    const nextCount = Math.max(0, likeCount + (nextLiked ? 1 : -1))

    setLikedByMe(nextLiked)
    setLikeCount(nextCount)
    setLoading(true)

    if (nextLiked) {
      setPop(true)
      setTimeout(() => setPop(false), 350)
    }

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
      className={`inline-flex items-center gap-1.5 text-sm transition-colors ${likedByMe ? 'text-rose-500' : 'text-snack-muted'} ${!accessToken ? 'opacity-60 cursor-not-allowed' : 'hover:text-rose-400'} ${className ?? ''}`}
      aria-label={likedByMe ? 'Unlike post' : 'Like post'}
      aria-pressed={likedByMe}
      title={accessToken ? (likedByMe ? 'Unlike' : 'Like') : 'Log in to like'}
    >
      <span
        aria-hidden="true"
        className={`block transition-transform duration-150 ${pop ? 'scale-125' : 'scale-100'}`}
        style={{ willChange: 'transform' }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill={likedByMe ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={likedByMe ? 0 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </span>
      <span>{likeCount}</span>
    </button>
  )
}
