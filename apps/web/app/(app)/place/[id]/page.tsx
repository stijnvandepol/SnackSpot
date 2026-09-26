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
import { getCityPageSlug } from '@/lib/city-index'
import { getDishPageHrefs } from '@/lib/dish-index'
import { reviewListSelect, serializeReview } from '@/lib/review-helpers'
import { PlaceReviewsSection, type PlaceReviewListItem } from '@/components/place-reviews-section'
import { Breadcrumb } from '@/components/breadcrumb'
import { PlaceMapEmbed } from '@/components/place-map-embed'
import { SavePlaceButton } from '@/components/save-place-button'
import { ReportPlace } from '@/components/report-place'
import { TrackView } from '@/components/track-view'

interface PlaceRow {
  id: string
  name: string
  address: string
  city: string | null
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
      p.city,
      p.cuisine,
      ST_Y(p.location::geometry) AS lat,
      ST_X(p.location::geometry) AS lng,
      ROUND(AVG(r.rating_overall)::numeric, 1)::float AS avg_rating,
      COUNT(r.id)::int AS review_count
    FROM places p
    LEFT JOIN reviews r ON r.place_id = p.id AND r.status = 'PUBLISHED'
    WHERE p.id = ${id}
    GROUP BY p.id, p.name, p.address, p.city, p.cuisine, p.location
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
  if (!place) return { title: 'Snackplek' }

  // Same source as the page body (places.city first), so title and breadcrumb agree.
  const city = place.city?.trim() || extractCity(place.address)
  // "<zaak> reviews" is how these pages are searched (GSC: "da verdi reviews",
  // "reviews voor da verdi"), and the bare "Name — City" title matched none of it:
  // place pages had impressions but a 0% click-through rate.
  const hasReviews = place.avg_rating !== null && place.review_count > 0
  const rating = hasReviews ? place.avg_rating!.toFixed(1).replace('.', ',') : ''
  const reviewLabel = `${place.review_count} review${place.review_count === 1 ? '' : 's'}`
  const title = hasReviews
    ? `${place.name}${city ? ` in ${city}` : ''}: ${rating} ★ uit ${reviewLabel}`
    : `${place.name}${city ? ` in ${city}` : ''}: reviews en foto's`
  const description = hasReviews
    ? `${place.name}${city ? ` in ${city}` : ''} scoort gemiddeld ${rating} ★ uit ${reviewLabel}. Bekijk foto's, welke gerechten bezoekers bestelden en hoe ze die beoordeelden.`
    : `${place.name}${city ? ` in ${city}` : ''} staat op SnackSpot, maar heeft nog geen reviews. Schrijf de eerste review en laat zien wat je er bestelde.`

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
  if (from === 'search' || !from) crumbs.push({ label: 'Ontdek', href: '/search' })
  else if (from === 'nearby') crumbs.push({ label: 'Dichtbij', href: '/nearby' })
  else if (from === 'feed') crumbs.push({ label: 'Home', href: '/' })
  else if (from === 'profile') crumbs.push({ label: 'Profiel', href: '/profile' })
  else if (from.startsWith('user:')) {
    const username = from.slice('user:'.length)
    crumbs.push({ label: `@${username}`, href: `/u/${encodeURIComponent(username)}` })
  }
  crumbs.push({ label: placeName })
  return crumbs
}

/** A fixed set, so a crafted `?from=` cannot mint new analytics counters. */
const PLACE_VIEW_SOURCES = new Set(['search', 'nearby', 'feed', 'profile', 'user', 'place', 'review'])

function placeViewSource(from: string | undefined): string {
  const kind = from?.split(':')[0]
  return kind && PLACE_VIEW_SOURCES.has(kind) ? kind : 'direct'
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

  // places.city is the column the city landing pages group on; extractCity() covers rows
  // written before that column was populated on every insert path.
  const city = place.city?.trim() || extractCity(place.address)

  // Five independent reads: run together instead of one after another, so the page waits
  // for the slowest query rather than the sum of all of them.
  const [topDishes, initialReviewRows, photoUrl, cityPageSlug, dishHrefs] = await Promise.all([
    // "Order This": the dishes people actually order here, aggregated from
    // dish-named reviews — the answer Google doesn't have.
    prisma.$queryRaw<Array<{ dish: string; review_count: number; avg_rating: number; pct: number }>>`
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
    `,
    // Server-render the first page of reviews so the content is crawlable and
    // instantly visible; the client section takes over for sorting and like-state.
    prisma.review.findMany({
      where: { placeId: id, status: ReviewStatus.PUBLISHED },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: reviewListSelect(),
    }),
    getPlacePhoto(id),
    // Only links to a city that actually has a page — a city below the quality gate 404s.
    getCityPageSlug(city),
    // Dish names link to their national ranking when one exists.
    getDishPageHrefs().catch(() => new Map<string, string>()),
  ])

  const initialReviews = initialReviewRows.map((row) => ({
    ...serializeReview(row),
    createdAt: row.createdAt.toISOString(),
  })) as unknown as PlaceReviewListItem[]

  const backHref = resolveBackHref(from)

  const appUrl = getSiteUrl()
  const cuisine = cuisineLabel(place.cuisine)
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

  // Mirrors the on-page trail. When the city has a landing page it becomes the parent,
  // which is also the relationship the internal link below expresses.
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'SnackSpot', item: appUrl },
      ...(cityPageSlug && city
        ? [{ '@type': 'ListItem', position: 2, name: `Snackplekken in ${city}`, item: `${appUrl}/snackplekken/${cityPageSlug}` }]
        : []),
      {
        '@type': 'ListItem',
        position: cityPageSlug && city ? 3 : 2,
        name: place.name,
        item: `${appUrl}/place/${place.id}`,
      },
    ],
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <TrackView event="place_view" source={placeViewSource(from)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      <Breadcrumb items={buildPlaceBreadcrumb(from, place.name)} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href={backHref} className="btn-secondary text-sm">Terug</Link>
        <div className="flex gap-2">
          <SavePlaceButton placeId={place.id} />
          <Link href={`/add-review?placeId=${place.id}`} className="btn-primary flex-1 text-sm sm:flex-none">
            Schrijf een review
          </Link>
        </div>
      </div>

      <div className="md:grid md:grid-cols-12 md:gap-6 md:items-start">
        {/* Left column: place info card + map */}
        <div className="md:col-span-5 mb-6 md:mb-0 space-y-4">
          <div className="card p-5">
            <h1 className="text-2xl font-heading font-bold text-snack-text break-words">{place.name}</h1>
            <p className="mt-1 text-sm text-snack-muted">{place.address}</p>
            {cityPageSlug && city && (
              <p className="mt-2 text-sm">
                <Link
                  href={`/snackplekken/${cityPageSlug}`}
                  className="font-semibold text-snack-primary hover:underline"
                >
                  Alle snackplekken in {city}
                </Link>
              </p>
            )}
            {cuisineLabel(place.cuisine) && (
              <span className="mt-2 inline-block rounded-full bg-snack-surface px-2.5 py-1 text-xs font-medium text-snack-primary">
                {cuisineLabel(place.cuisine)}
              </span>
            )}

            <div className="mt-4 flex items-center gap-4 rounded-xl bg-snack-surface px-4 py-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">Cijfer</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-snack-rating text-sm">{place.avg_rating !== null ? '★'.repeat(Math.max(1, Math.round(place.avg_rating ?? 0))) : '-'}</span>
                  <span className="font-semibold text-snack-text">{place.avg_rating?.toFixed(1).replace('.', ',') ?? '-'}</span>
                </div>
              </div>
              <div className="h-8 w-px bg-snack-border" />
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">Reviews</p>
                <p className="mt-1 font-semibold text-snack-text">{place.review_count}</p>
              </div>
            </div>
            <a
              href={`https://www.google.com/maps?q=${place.lat},${place.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-2 rounded-xl border border-snack-border px-4 py-3 text-sm font-semibold text-snack-primary transition hover:bg-snack-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snack-primary focus-visible:ring-offset-2"
              aria-label={`Open ${place.name} in Google Maps`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Open in Google Maps
            </a>
            <div className="mt-3">
              <ReportPlace placeId={place.id} placeName={place.name} />
            </div>
          </div>
          {topDishes.length > 0 && (
            <div className="card p-5">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">
                Meest beoordeelde gerechten
              </p>
              <ul className="mt-3 space-y-2.5">
                {topDishes.map((d, i) => (
                  <li key={d.dish} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-snack-text">
                        {i === 0 && <span aria-hidden="true">🏆 </span>}
                        {dishHrefs.get(d.dish.trim().toLowerCase()) ? (
                          <Link
                            href={dishHrefs.get(d.dish.trim().toLowerCase())!}
                            className="hover:text-snack-primary hover:underline"
                          >
                            {d.dish}
                          </Link>
                        ) : (
                          d.dish
                        )}
                      </p>
                      <p className="text-xs text-snack-muted">
                        {d.pct}% van de gerechtreviews hier
                        {d.review_count > 1 ? ` · ${d.review_count} reviews` : ''}
                      </p>
                    </div>
                    <span className="flex-shrink-0 rounded-full bg-snack-surface px-2.5 py-1 text-sm font-semibold text-snack-text">
                      ★ {d.avg_rating.toFixed(1).replace('.', ',')}
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
            <p className="mt-1.5 text-xs text-snack-muted">
              Locatie- en kaartgegevens &copy;{' '}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                OpenStreetMap
              </a>
              -bijdragers
            </p>
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
