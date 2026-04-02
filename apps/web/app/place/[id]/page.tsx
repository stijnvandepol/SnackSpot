import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getSiteUrl } from '@/lib/site-url'
import { PlaceReviewsSection } from '@/components/place-reviews-section'
import { Breadcrumb } from '@/components/breadcrumb'
import { PlaceMapEmbed } from '@/components/place-map-embed'

interface PlaceRow {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  avg_rating: number | null
  review_count: number
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

  const [place] = await prisma.$queryRaw<PlaceRow[]>`
    SELECT
      p.id,
      p.name,
      p.address,
      ST_Y(p.location::geometry) AS lat,
      ST_X(p.location::geometry) AS lng,
      ROUND(AVG(r.rating_overall)::numeric, 1)::float AS avg_rating,
      COUNT(r.id)::int AS review_count
    FROM places p
    LEFT JOIN reviews r ON r.place_id = p.id AND r.status = 'PUBLISHED'
    WHERE p.id = ${id}
    GROUP BY p.id, p.name, p.address, p.location
  `

  if (!place) notFound()

  const backHref = resolveBackHref(from)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: place.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: place.address,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: place.lat,
      longitude: place.lng,
    },
    url: `${getSiteUrl()}/place/${place.id}`,
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
            <h1 className="text-2xl font-heading font-bold text-snack-text">{place.name}</h1>
            <p className="mt-1 text-sm text-snack-muted">{place.address}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-snack-surface px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">Rating</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-snack-rating">{place.avg_rating !== null ? '★'.repeat(Math.max(1, Math.round(place.avg_rating ?? 0))) : '—'}</span>
                  <span className="font-semibold text-snack-text">{place.avg_rating?.toFixed(1) ?? 'No rating yet'}</span>
                </div>
              </div>
              <div className="rounded-xl bg-snack-surface px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">Reviews</p>
                <p className="mt-1 font-semibold text-snack-text">{place.review_count} {place.review_count === 1 ? 'post' : 'posts'}</p>
              </div>
              <a
                href={`https://www.google.com/maps?q=${place.lat},${place.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-snack-surface px-4 py-3 transition hover:bg-[#eef2f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snack-primary focus-visible:ring-offset-2"
                aria-label={`Open ${place.name} in maps`}
              >
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">Directions</p>
                <p className="mt-1 font-semibold text-snack-primary">Open in maps</p>
              </a>
            </div>
          </div>
          <PlaceMapEmbed
            lat={place.lat}
            lng={place.lng}
            className="h-48 rounded-xl overflow-hidden"
          />
        </div>

        {/* Right column: reviews */}
        <div className="md:col-span-7">
          <h2 className="text-base font-semibold text-snack-text mb-3">Reviews</h2>
          <PlaceReviewsSection
            placeId={place.id}
            placeName={place.name}
            placeAddress={place.address}
            from={from}
          />
        </div>
      </div>
    </div>
  )
}
