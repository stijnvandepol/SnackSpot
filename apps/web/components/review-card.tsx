import Link from 'next/link'
import { photoVariantUrl } from '@/lib/photo-url'
import { ReviewLikeButton } from '@/components/review-like-button'
import { AvatarLightbox } from '@/components/avatar-lightbox'

interface ReviewCardProps {
  review: {
    id: string
    rating: number
    text: string
    dishName?: string | null
    createdAt: Date | string
    overallRating?: number
    ratings?: { taste: number; value: number; portion: number; service?: number | null }
    user: { id: string; username: string; avatarKey?: string | null }
    place?: { id: string; name: string; address: string }
    likeCount?: number
    commentCount?: number
    likedByMe?: boolean
    reviewPhotos?: Array<{ photo: { id: string; variants: Record<string, string> } }>
  }
  showPlace?: boolean
  photoVariantPreference?: ReadonlyArray<'thumb' | 'medium' | 'large'>
  backContext?: string
}

function timeAgo(dateInput: Date | string): string {
  const date = new Date(dateInput)
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 60)    return 'just now'
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-snack-rating text-sm">
      {'★'.repeat(rating)}
      <span className="text-[#e0e0e0]">{'★'.repeat(5 - rating)}</span>
    </span>
  )
}

export function ReviewCard({
  review,
  showPlace = true,
  photoVariantPreference = ['thumb', 'medium', 'large'],
  backContext,
}: ReviewCardProps) {
  const thumb =
    review.reviewPhotos
      ?.map((rp) => photoVariantUrl(rp.photo.variants as Record<string, string>, photoVariantPreference))
      .find((url): url is string => Boolean(url)) ?? null

  const reviewHref = backContext
    ? `/review/${review.id}?from=${encodeURIComponent(backContext)}`
    : `/review/${review.id}`

  return (
    <article className="card overflow-hidden transition hover:shadow-md">
      <Link href={reviewHref} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snack-primary focus-visible:ring-offset-2 rounded-xl" aria-label={`Open review by ${review.user.username}`}>
        {thumb && (
          <div className="relative h-64 w-full bg-snack-surface md:h-72">
            <img
              src={thumb}
              alt={review.dishName ?? 'Review photo'}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {review.dishName && (
                <p className="font-semibold text-snack-text truncate">{review.dishName}</p>
              )}
              {showPlace && review.place && (
                <p className="text-xs text-snack-muted truncate">{review.place.name}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-snack-text">{(review.overallRating ?? review.rating).toFixed(1)}</p>
              <Stars rating={Math.round(review.overallRating ?? review.rating)} />
            </div>
          </div>

          {review.ratings && (
            <p className="text-xs text-snack-muted">
              Taste {review.ratings.taste} • Value {review.ratings.value} • Portion {review.ratings.portion}
              {typeof review.ratings.service === 'number' ? ` • Service ${review.ratings.service}` : ''}
            </p>
          )}

          <p className="text-sm text-snack-muted line-clamp-3">{review.text}</p>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <AvatarLightbox avatarKey={review.user.avatarKey} username={review.user.username} size="sm" />
              <span className="text-xs text-snack-muted">
                {review.user.username}
              </span>
            </div>
            <time className="text-xs text-snack-muted">{timeAgo(review.createdAt)}</time>
          </div>
        </div>
      </Link>
      <div className="px-4 pb-4 -mt-1 flex items-center justify-between gap-3">
        <span className="text-xs text-snack-muted">
          {review.commentCount ?? 0} {(review.commentCount ?? 0) === 1 ? 'comment' : 'comments'}
        </span>
        <ReviewLikeButton
          reviewId={review.id}
          initialLikeCount={review.likeCount ?? 0}
          initialLikedByMe={Boolean(review.likedByMe)}
        />
      </div>
    </article>
  )
}
