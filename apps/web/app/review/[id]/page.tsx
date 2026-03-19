import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/db'
import { ReviewStatus } from '@prisma/client'
import { photoVariantUrl } from '@/lib/photo-url'
import { getReviewTagLabel } from '@/lib/review-tags'
import { extractCity } from '@/lib/utils'
import { ReviewInteractions } from '@/components/review-interactions'

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})

function formatDate(dateInput: Date) {
  return dateFormatter.format(dateInput)
}

function resolveBackHref(from: string | undefined, parsedPlaceContext: { placeId: string; origin: string } | null): string {
  if (!from) return '/feed'
  if (from === 'feed') return '/feed'
  if (from === 'profile') return '/profile'
  if (parsedPlaceContext) {
    return `/place/${encodeURIComponent(parsedPlaceContext.placeId)}?from=${encodeURIComponent(parsedPlaceContext.origin)}`
  }
  if (from.startsWith('user:')) {
    const username = from.slice('user:'.length)
    return username ? `/u/${encodeURIComponent(username)}` : '/feed'
  }
  return '/feed'
}

function parsePlaceContext(from: string | undefined) {
  if (!from || !from.startsWith('place:')) return null
  const parts = from.split(':')
  const placeId = parts[1] ?? ''
  const encodedOrigin = parts.slice(2).join(':')
  const origin = encodedOrigin ? decodeURIComponent(encodedOrigin) : 'search'
  return placeId ? { placeId, origin } : null
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams

  const review = await prisma.review.findUnique({
    where: { id },
    select: {
      id: true,
      rating: true,
      ratingTaste: true,
      ratingValue: true,
      ratingPortion: true,
      ratingService: true,
      ratingOverall: true,
      text: true,
      dishName: true,
      status: true,
      createdAt: true,
      userId: true,
      tags: { orderBy: { tag: 'asc' }, select: { tag: true } },
      _count: { select: { reviewLikes: true, comments: true } },
      user: { select: { id: true, username: true, avatarKey: true, role: true } },
      place: { select: { id: true, name: true, address: true } },
      reviewPhotos: {
        orderBy: { sortOrder: 'asc' },
        select: { sortOrder: true, photo: { select: { id: true, variants: true } } },
      },
    },
  })

  if (!review || review.status === ReviewStatus.DELETED || review.status === ReviewStatus.HIDDEN) {
    notFound()
  }

  const overallRating = Number(review.ratingOverall)
  const tags = review.tags.map((t) => t.tag)
  const parsedPlaceContext = parsePlaceContext(from)
  const backHref = resolveBackHref(from, parsedPlaceContext)
  const editHref = from ? `/review/${id}/edit?from=${encodeURIComponent(from)}` : `/review/${id}/edit`
  const placeLinkHref = parsedPlaceContext
    ? `/place/${encodeURIComponent(parsedPlaceContext.placeId)}?from=${encodeURIComponent(parsedPlaceContext.origin)}`
    : `/place/${review.place.id}?from=feed`

  const photos = review.reviewPhotos

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Link href={backHref} className="btn-secondary text-sm">
          Back
        </Link>
      </div>

      {/* Photo gallery */}
      {photos.length > 0 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(photos.length, 3)}, 1fr)` }}>
          {photos.map((rp) => {
            const src = photoVariantUrl(rp.photo.variants as Record<string, string>, ['large', 'medium', 'thumb'])
            return src ? (
              <div key={rp.photo.id} className="aspect-square rounded-2xl overflow-hidden bg-snack-surface">
                <Image
                  src={src}
                  alt={review.dishName ?? 'Review photo'}
                  width={400}
                  height={400}
                  className="h-full w-full object-cover"
                  priority={rp.sortOrder === 0}
                />
              </div>
            ) : null
          })}
        </div>
      )}

      {/* Review body */}
      <div className="card p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            {review.dishName && (
              <h1 className="font-heading font-bold text-lg text-snack-text">{review.dishName}</h1>
            )}
            <Link href={placeLinkHref} className="text-sm text-snack-primary hover:underline">
              {review.place.name}
              {extractCity(review.place.address) && (
                <span className="text-snack-muted font-normal"> · {extractCity(review.place.address)}</span>
              )}
            </Link>
          </div>
          <div className="text-snack-rating text-lg flex-shrink-0">
            {'★'.repeat(Math.round(overallRating))}
            <span className="text-[#e0e0e0]">{'★'.repeat(5 - Math.round(overallRating))}</span>
            <p className="text-xs text-snack-muted text-right mt-0.5">{overallRating.toFixed(1)}</p>
          </div>
        </div>

        <p className="text-xs text-snack-muted">
          Taste {Number(review.ratingTaste)} • Value {Number(review.ratingValue)} • Portion {Number(review.ratingPortion)}
          {review.ratingService !== null ? ` • Service ${Number(review.ratingService)}` : ''}
        </p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-snack-surface px-2.5 py-1 text-xs font-medium text-snack-primary"
              >
                {getReviewTagLabel(tag)}
              </span>
            ))}
          </div>
        )}

        <p className="whitespace-pre-line text-snack-muted">{review.text}</p>
      </div>

      {/* Interactive section: likes, comments, author, report, owner actions */}
      <ReviewInteractions
        reviewId={review.id}
        reviewUserId={review.userId}
        reviewUsername={review.user.username}
        initialLikeCount={review._count.reviewLikes}
        initialCommentCount={review._count.comments}
        createdAt={review.createdAt.toISOString()}
        avatarKey={review.user.avatarKey}
        editHref={editHref}
        isOwnerAllowed={true}
      />
    </div>
  )
}
