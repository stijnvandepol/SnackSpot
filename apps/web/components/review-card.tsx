import Link from 'next/link'

interface ReviewCardProps {
  review: {
    id: string
    rating: number
    text: string
    dishName?: string | null
    createdAt: Date | string
    user: { id: string; username: string; displayName?: string | null; avatarKey?: string | null }
    place?: { id: string; name: string; address: string }
    reviewPhotos?: Array<{ photo: { id: string; variants: Record<string, string> } }>
  }
  showPlace?: boolean
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

const MINIO_PUBLIC = process.env.NEXT_PUBLIC_MINIO_PUBLIC_URL ?? 'http://localhost:9000'
const BUCKET = process.env.NEXT_PUBLIC_MINIO_BUCKET ?? 'snackspot'

function photoUrl(variants: Record<string, string>): string | null {
  const key = variants?.thumb ?? variants?.medium ?? variants?.large ?? null
  if (!key) return null
  return `${MINIO_PUBLIC}/${BUCKET}/${key}`
}

export function ReviewCard({ review, showPlace = true }: ReviewCardProps) {
  const thumb = review.reviewPhotos?.[0]
    ? photoUrl(review.reviewPhotos[0].photo.variants as Record<string, string>)
    : null

  return (
    <Link href={`/review/${review.id}`} className="block">
      <article className="card overflow-hidden transition hover:shadow-md">
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
            <Stars rating={review.rating} />
          </div>

          <p className="text-sm text-snack-muted line-clamp-3">{review.text}</p>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-snack-surface flex items-center justify-center text-snack-primary font-semibold text-xs uppercase flex-shrink-0">
                {(review.user.displayName ?? review.user.username)[0]}
              </div>
              <span className="text-xs text-snack-muted">
                {review.user.displayName ?? review.user.username}
              </span>
            </div>
            <time className="text-xs text-snack-muted">{timeAgo(review.createdAt)}</time>
          </div>
        </div>
      </article>
    </Link>
  )
}
