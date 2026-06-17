import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ReviewStatus } from '@prisma/client'
import { cuisineLabel } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { getSiteUrl } from '@/lib/site-url'
import { safeJsonLd } from '@/lib/html'
import { photoVariantUrl } from '@/lib/photo-url'
import { extractCity } from '@/lib/utils'
import { reviewListSelect, serializeReview } from '@/lib/review-helpers'
import { PlaceReviewsSection, type PlaceReviewListItem } from '@/components/place-reviews-section'
import { Breadcrumb } from '@/components/breadcrumb'
import { PlaceMapEmbed } from '@/components/place-map-embed'

interface PlaceRow {
  id: string
  name: string
  address: string
  cuisine: string | null
  lat: number
  lng: number
  avg_rating: number | null
  review_count: number
}

// Cached so the page body and generateMetadata share a single query per request.
const getPlace = cache(async (id: string): Promise<PlaceRow | null> => {
  const [place] = await prisma.$queryRaw<PlaceRow[]>`
    SELECT
      p.id,
      p.name,
      p.address,
      p.cuisine,
      ST_Y(p.location::geometry) AS lat,
      ST_X(p.location::geometry) AS lng,
      ROUND(AVG(r.rating_overall)::numeric, 1)::float AS avg_rating,
      COUNT(r.id)::int AS review_count
    FROM places p
    LEFT JOIN reviews r ON r.place_id = p.id AND r.status = 'PUBLISHED'
    WHERE p.id = ${id}
    GROUP BY p.id, p.name, p.address, p.cuisine, p.location
  `
  return place ?? null
})

// Most recent published food photo for the place — used as the social-share (OG)
// image and the Restaurant JSON-LD image. Cached so metadata + body share one query.
const getPlacePhoto = cache(async (id: string): Promise<string | null> => {
  const review = await prisma.review.findFirst({
    where: { placeId: id, status: ReviewStatus.PUBLISHED, reviewPhotos: { some: {} } },
    orderBy: { createdAt: 'desc' },
    select: {
      reviewPhotos: {
        orderBy: { sortOrder: 'asc' },
        take: 1,
        select: { photo: { select: { variants: true } } },
      },
    },
  })
  const variants = review?.reviewPhotos[0]?.photo.variants
  return variants ? photoVariantUrl(variants as Record<string, string>, ['large', 'medium', 'thumb']) : null
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const place = await getPlace(id)
  if (!place) return { title: 'Place' }

  const city = extractCity(place.address)
  const title = city ? `${place.name} — ${city}` : place.name
  const description =
    place.avg_rating !== null && place.review_count > 0
      ? `${place.name} is rated ${place.avg_rating.toFixed(1)}★ from ${place.review_count} photo review${place.review_count === 1 ? '' : 's'} on SnackSpot. See real dishes and know what to order before you go.`
      : `Discover ${place.name} on SnackSpot, photo reviews from real people, so you know what to order before you go.`

  const ogImage = await getPlacePhoto(id)

  return {
    title,
    description,
    alternates: { canonical: `/place/${place.id}` },
    openGraph: { type: 'website', title, description, ...(ogImage ? { images: [ogImage] } : {}) },
    twitter: { card: 'summary_large_image', title, description, ...(ogImage ? { images: [ogImage] } : {}) },
  }
}

function buildPlaceBreadcrumb(from: string | undefined, placeName: string): Array<{ label: string; href?: string }> {
  const crumbs: Array<{ label: string; href?: string }> = []
  if (from === 'search' || !from) crumbs.push({ label: 'Explore', href: '/search' })
  else if (from === 'nearby') crumbs.push({ label: 'Nearby', href: '/nearby' })
  else if (from === 'feed') crumbs.push({ label: 'Feed', href: '/' })
  else if (from === 'profile') crumbs.push({ label: 'Profile', href: '/profile' })
  else if (from.startsWith('user:')) {
    const username = from.slice('user:'.length)
    crumbs.push({ label: `@${username}`, href: `/u/${encodeURIComponent(username)}` })
  }
  crumbs.push({ label: placeName })
  return crumbs
}

function resolveBackHref(from: string | undefined): string {
  if (!from) return '/search'
  if (from === 'search') return '/search'
  if (from === 'nearby') return '/nearby'
  if (from === 'feed') return '/'
  if (from === 'profile') return '/profile'
  if (from.startsWith('user:')) {
    const username = from.slice('user:'.length)
    return username ? `/u/${encodeURIComponent(username)}` : '/search'
  }
  return '/search'
}

export default async function PlacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams

  const place = await getPlace(id)

  if (!place) notFound()

  // "Order This": the dishes people actually order here, aggregated from
  // dish-named reviews — the answer Google doesn't have.
  const topDishes = await prisma.$queryRaw<
    Array<{ dish: string; review_count: number; avg_rating: number; pct: number }>
  >`
    WITH dish_reviews AS (
      SELECT TRIM(dish_name) AS dish_raw, LOWER(TRIM(dish_name)) AS dish_key, rating_overall
      FROM reviews
      WHERE place_id = ${id} AND status = 'PUBLISHED'
        AND dish_name IS NOT NULL AND LENGTH(TRIM(dish_name)) > 0
    )
    SELECT
      MIN(dish_raw) AS dish,
      COUNT(*)::int AS review_count,
      ROUND(AVG(rating_overall)::numeric, 1)::float AS avg_rating,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ())::int AS pct
    FROM dish_reviews
    GROUP BY dish_key
    ORDER BY review_count DESC, avg_rating DESC
    LIMIT 3
  `

  // Server-render the first page of reviews so the content is crawlable and
  // instantly visible; the client section takes over for sorting and like-state.
  const initialReviewRows = await prisma.review.findMany({
    where: { placeId: id, status: ReviewStatus.PUBLISHED },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: reviewListSelect(),
  })
  const initialReviews = initialReviewRows.map((row) => ({
    ...serializeReview(row),
    createdAt: row.createdAt.toISOString(),
  })) as unknown as PlaceReviewListItem[]

  const backHref = resolveBackHref(from)

  const appUrl = getSiteUrl()
  const photoUrl = await getPlacePhoto(id)
  const cuisine = cuisineLabel(place.cuisine)
  const city = extractCity(place.address)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: place.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: place.address,
      ...(city ? { addressLocality: city } : {}),
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: place.lat,
      longitude: place.lng,
    },
    url: `${appUrl}/place/${place.id}`,
    ...(cuisine ? { servesCuisine: cuisine } : {}),
    ...(photoUrl ? { image: [`${appUrl}${photoUrl}`] } : {}),
    ...(place.avg_rating !== null && place.review_count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: place.avg_rating,
            reviewCount: place.review_count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'SnackSpot', item: appUrl },
      { '@type': 'ListItem', position: 2, name: place.name, item: `${appUrl}/place/${place.id}` },
    ],
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      <Breadcrumb items={buildPlaceBreadcrumb(from, place.name)} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href={backHref} className="btn-secondary text-sm">Back</Link>
        <Link href={`/add-review?placeId=${place.id}`} className="btn-primary text-sm">
          Write review
        </Link>
      </div>

      <div className="md:grid md:grid-cols-12 md:gap-6 md:items-start">
        {/* Left column: place info card + map */}
        <div className="md:col-span-5 mb-6 md:mb-0 space-y-4">
          <div className="card p-5">
            <h1 className="text-2xl font-heading font-bold text-snack-text break-words">{place.name}</h1>
            <p className="mt-1 text-sm text-snack-muted">{place.address}</p>
            {cuisineLabel(place.cuisine) && (
              <span className="mt-2 inline-block rounded-full bg-snack-surface px-2.5 py-1 text-xs font-medium text-snack-primary">
                {cuisineLabel(place.cuisine)}
              </span>
            )}

            <div className="mt-4 flex items-center gap-4 rounded-xl bg-snack-surface px-4 py-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">Rating</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-snack-rating text-sm">{place.avg_rating !== null ? '★'.repeat(Math.max(1, Math.round(place.avg_rating ?? 0))) : '-'}</span>
                  <span className="font-semibold text-snack-text">{place.avg_rating?.toFixed(1) ?? '-'}</span>
                </div>
              </div>
              <div className="h-8 w-px bg-snack-border" />
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">Reviews</p>
                <p className="mt-1 font-semibold text-snack-text">{place.review_count} {place.review_count === 1 ? 'post' : 'posts'}</p>
              </div>
            </div>
            <a
              href={`https://www.google.com/maps?q=${place.lat},${place.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-2 rounded-xl border border-snack-border px-4 py-3 text-sm font-semibold text-snack-primary transition hover:bg-snack-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snack-primary focus-visible:ring-offset-2"
              aria-label={`Open ${place.name} in maps`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Open in Maps
            </a>
          </div>
          {topDishes.length > 0 && (
            <div className="card p-5">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">
                Order this
              </p>
              <ul className="mt-3 space-y-2.5">
                {topDishes.map((d, i) => (
                  <li key={d.dish} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-snack-text">
                        {i === 0 && <span aria-hidden="true">🏆 </span>}
                        {d.dish}
                      </p>
                      <p className="text-xs text-snack-muted">
                        {d.pct}% of dish reviews here
                        {d.review_count > 1 ? ` · ${d.review_count} reviews` : ''}
                      </p>
                    </div>
                    <span className="flex-shrink-0 rounded-full bg-snack-surface px-2.5 py-1 text-sm font-semibold text-snack-text">
                      ★ {d.avg_rating.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="hidden md:block">
            <PlaceMapEmbed
              lat={place.lat}
              lng={place.lng}
              className="h-48 rounded-xl overflow-hidden"
            />
          </div>
        </div>

        {/* Right column: reviews */}
        <div className="md:col-span-7">
          <PlaceReviewsSection
            placeId={place.id}
            placeName={place.name}
            placeAddress={place.address}
            from={from}
            initialReviews={initialReviews}
          />
        </div>
      </div>
    </div>
  )
}
