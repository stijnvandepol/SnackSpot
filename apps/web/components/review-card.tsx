import Link from 'next/link'
import { photoVariantUrl } from '@/lib/photo-url'
import { ReviewLikeButton } from '@/components/review-like-button'
import { AvatarLightbox } from '@/components/avatar-lightbox'
import { MentionText } from '@/components/mention-text'

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
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-sm text-snack-rating">
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
      <div className="relative">
        <Link
          href={reviewHref}
          className="absolute inset-0 rounded-xl focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snack-primary focus-visible:ring-offset-2"
          aria-label={`Open review by ${review.user.username}`}
        />
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
        <div className="relative z-10 space-y-2 p-4 pointer-events-none">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {review.dishName && (
                <p className="truncate font-semibold text-snack-text">{review.dishName}</p>
              )}
              {showPlace && review.place && (
                <p className="truncate text-xs text-snack-muted">{review.place.name}</p>
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

          <MentionText
            text={review.text}
            className="line-clamp-3 whitespace-pre-line text-sm text-snack-muted"
            mentionClassName="pointer-events-auto"
          />

          <div className="flex items-center justify-between pt-1">
            <div className="pointer-events-auto flex items-center gap-2">
              <AvatarLightbox avatarKey={review.user.avatarKey} username={review.user.username} size="sm" />
              <Link href={`/u/${review.user.username}`} className="text-xs text-snack-muted hover:underline">
                {review.user.username}
              </Link>
            </div>
            <time className="text-xs text-snack-muted">{timeAgo(review.createdAt)}</time>
          </div>
        </div>
      </div>
      <div className="relative z-10 -mt-1 flex items-center justify-between gap-3 px-4 pb-4">
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
