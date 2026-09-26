import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { ReviewStatus } from '@prisma/client'
import { photoVariantUrl } from '@/lib/photo-url'
import { getReviewTagLabel } from '@/lib/review-tags'
import { extractCity } from '@/lib/utils'
import { getSiteUrl } from '@/lib/site-url'
import { safeJsonLd } from '@/lib/html'
import { ReviewInteractions } from '@/components/review-interactions'
import { MentionText } from '@/components/mention-text'
import { ImageLightbox } from '@/components/image-lightbox'
import { Breadcrumb } from '@/components/breadcrumb'
import { ShareButton } from '@/components/share-button'
import {
  buildReviewShareText,
  buildReviewShareTitle,
  reviewShareCardPath,
  reviewSharePath,
} from '@/lib/share'
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from '@/lib/share-card'

function resolveBackHref(from: string | undefined, parsedPlaceContext: { placeId: string; origin: string } | null): string {
  if (!from) return '/'
  if (from === 'feed') return '/'
  if (from === 'profile') return '/profile'
  if (parsedPlaceContext) {
    return `/place/${encodeURIComponent(parsedPlaceContext.placeId)}?from=${encodeURIComponent(parsedPlaceContext.origin)}`
  }
  if (from.startsWith('user:')) {
    const username = from.slice('user:'.length)
    return username ? `/u/${encodeURIComponent(username)}` : '/'
  }
  return '/'
}

function parsePlaceContext(from: string | undefined) {
  if (!from || !from.startsWith('place:')) return null
  const parts = from.split(':')
  const placeId = parts[1] ?? ''
  const encodedOrigin = parts.slice(2).join(':')
  const origin = encodedOrigin ? decodeURIComponent(encodedOrigin) : 'search'
  return placeId ? { placeId, origin } : null
}

function buildReviewBreadcrumb(
  from: string | undefined,
  placeName: string,
  placeId: string,
  parsedPlaceContext: { placeId: string; origin: string } | null,
): Array<{ label: string; href?: string }> {
  const crumbs: Array<{ label: string; href?: string }> = []

  if (parsedPlaceContext) {
    // Came from a place page — show the place as the parent
    crumbs.push({
      label: placeName,
      href: `/place/${encodeURIComponent(parsedPlaceContext.placeId)}?from=${encodeURIComponent(parsedPlaceContext.origin)}`,
    })
  } else if (from === 'feed' || !from) {
    crumbs.push({ label: 'Home', href: '/' })
  } else if (from === 'profile') {
    crumbs.push({ label: 'Profiel', href: '/profile' })
  } else if (from.startsWith('user:')) {
    const username = from.slice('user:'.length)
    crumbs.push({ label: `@${username}`, href: `/u/${encodeURIComponent(username)}` })
  }

  crumbs.push({ label: 'Review' })
  return crumbs
}

// Cached so the page body and generateMetadata share a single query per request.
const getReview = cache(async (id: string) =>
  prisma.review.findUnique({
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
      tags: { orderBy: { tag: 'asc' as const }, select: { tag: true } },
      _count: { select: { reviewLikes: true, comments: true } },
      user: { select: { id: true, username: true, avatarKey: true, role: true, isVerified: true } },
      place: { select: { id: true, name: true, address: true } },
      reviewPhotos: {
        orderBy: { sortOrder: 'asc' as const },
        select: { sortOrder: true, photo: { select: { id: true, variants: true } } },
      },
    },
  }),
)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const review = await getReview(id)

  if (!review || review.status !== ReviewStatus.PUBLISHED) {
    return { title: 'Review' }
  }

  const rating = Number(review.ratingOverall).toFixed(1).replace('.', ',')
  const city = extractCity(review.place.address)
  const title = review.dishName
    ? `${review.dishName} bij ${review.place.name}${city ? `, ${city}` : ''}: ${rating} ★`
    : `Review van ${review.place.name}${city ? `, ${city}` : ''}: ${rating} ★`
  const description =
    review.text.length > 155 ? `${review.text.slice(0, 152).trimEnd()}…` : review.text

  // The share card (photo + dish + rating + place, 1200×630 JPEG) rather than the raw
  // photo variant: WhatsApp drops to a tiny thumbnail — or nothing — above ~300 KB, and the
  // `large` WebP was 700 KB. Width/height/type are declared so scrapers can lay the preview
  // out before fetching the image. Relative URLs resolve against metadataBase.
  const ogImage = {
    url: reviewShareCardPath(review.id),
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    type: 'image/jpeg',
    alt: title,
  }

  return {
    title,
    description,
    alternates: { canonical: `/review/${review.id}` },
    openGraph: { type: 'article', title, description, locale: 'nl_NL', images: [ogImage] },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; posted?: string }>
}) {
  const { id } = await params
  // `posted=1` is set by the add-review flow right after publishing: the one moment the
  // author is proud enough to send the review to friends, so the page opens with the share
  // prompt instead of burying it in the footer.
  const { from, posted } = await searchParams
  const justPosted = posted === '1'

  const review = await getReview(id)

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
  const galleryImages = photos
    .map((rp) => {
      const src = photoVariantUrl(rp.photo.variants as Record<string, string>, ['large', 'medium', 'thumb'])
      const thumbnail = photoVariantUrl(rp.photo.variants as Record<string, string>, ['medium', 'thumb', 'large'])
      if (!src) return null
      return { src, thumbnail: thumbnail ?? src, alt: review.dishName ?? `Foto bij review van ${review.place.name}`, priority: rp.sortOrder === 0 }
    })
    .filter((img): img is NonNullable<typeof img> => img !== null)

  const shareInput = {
    dishName: review.dishName,
    placeName: review.place.name,
    city: extractCity(review.place.address),
    rating: overallRating,
  }
  const shareProps = {
    url: reviewSharePath(review.id),
    title: buildReviewShareTitle(shareInput),
    text: buildReviewShareText(shareInput),
  }

  const appUrl = getSiteUrl()
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'SnackSpot', item: appUrl },
      { '@type': 'ListItem', position: 2, name: review.place.name, item: `${appUrl}/place/${review.place.id}` },
      { '@type': 'ListItem', position: 3, name: review.dishName ?? `Review van ${review.place.name}`, item: `${appUrl}/review/${review.id}` },
    ],
  }
  const reviewJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': 'LocalBusiness',
      name: review.place.name,
      address: review.place.address,
    },
    author: {
      '@type': 'Person',
      name: review.user.username,
      url: `${appUrl}/u/${encodeURIComponent(review.user.username)}`,
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: overallRating,
      bestRating: 5,
      worstRating: 1,
    },
    reviewBody: review.text,
    datePublished: review.createdAt.toISOString(),
    url: `${appUrl}/review/${review.id}`,
    ...(review.dishName ? { name: review.dishName } : {}),
    ...(galleryImages.length > 0
      ? { image: galleryImages.map((img) => `${appUrl}${img.src}`) }
      : {}),
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(reviewJsonLd) }} />
      <Breadcrumb items={buildReviewBreadcrumb(from, review.place.name, review.place.id, parsedPlaceContext)} />
      <div className="flex items-center justify-between gap-2">
        <Link href={backHref} className="btn-secondary text-sm">
          Terug
        </Link>
        <ShareButton {...shareProps} variant="button" />
      </div>

      {justPosted && (
        <section
          className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: 'var(--snack-primary)' }}
          aria-live="polite"
        >
          <div>
            <p className="font-heading font-semibold text-snack-text">Je review staat online.</p>
            <p className="mt-0.5 text-sm text-snack-muted">
              Deel hem met je vrienden, dan weten ze wat ze hier moeten bestellen.
            </p>
          </div>
          <ShareButton {...shareProps} variant="primary" label="Deel je review" className="sm:flex-shrink-0" />
        </section>
      )}

      {/* Photo gallery */}
      {galleryImages.length > 0 && (
        <ImageLightbox
          images={galleryImages}
          containerClassName="grid gap-2"
          containerStyle={{ gridTemplateColumns: `repeat(${Math.min(galleryImages.length, 3)}, 1fr)` }}
          itemClassName="aspect-square rounded-2xl overflow-hidden bg-snack-surface cursor-zoom-in block w-full"
          thumbnailClassName="h-full w-full object-cover"
        />
      )}

      {/* Review body */}
      <div className="card p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-heading font-bold text-lg text-snack-text break-words">
              {review.dishName ?? review.place.name}
            </h1>
            {review.dishName && (
              <Link href={placeLinkHref} className="text-sm text-snack-primary hover:underline">
                {review.place.name}
                {extractCity(review.place.address) && (
                  <span className="text-snack-muted font-normal"> · {extractCity(review.place.address)}</span>
                )}
              </Link>
            )}
            {!review.dishName && (
              <Link href={placeLinkHref} className="text-sm text-snack-primary hover:underline">
                {extractCity(review.place.address) ?? review.place.address}
              </Link>
            )}
          </div>
          <div className="text-snack-rating text-lg flex-shrink-0">
            {'★'.repeat(Math.round(overallRating))}
            <span className="text-snack-border">{'★'.repeat(5 - Math.round(overallRating))}</span>
            <p className="text-xs text-snack-muted text-right mt-0.5">{overallRating.toFixed(1).replace('.', ',')}</p>
          </div>
        </div>

        <p className="text-xs text-snack-muted">
          Smaak {String(Number(review.ratingTaste)).replace('.', ',')} • Prijs {String(Number(review.ratingValue)).replace('.', ',')} • Portie {String(Number(review.ratingPortion)).replace('.', ',')}
          {review.ratingService !== null ? ` • Service ${String(Number(review.ratingService)).replace('.', ',')}` : ''}
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

        <MentionText text={review.text} className="whitespace-pre-line text-snack-muted" />
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
