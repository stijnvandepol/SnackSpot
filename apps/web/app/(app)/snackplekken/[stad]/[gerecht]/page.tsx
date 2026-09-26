import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCityDishDetail, type CityDishDetail } from '@/lib/city-index'
import { getDishPageHref } from '@/lib/dish-index'
import { getSiteUrl } from '@/lib/site-url'
import { safeJsonLd } from '@/lib/html'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'
import { TrackView } from '@/components/track-view'

// Cached for an hour on demand, matching /snackplekken/[stad] and app/sitemap.ts so the
// page, its parent and the sitemap all age at the same rate. No generateStaticParams for
// the same reason as every other database-backed route here: `next build` has no database.
//
// A dish below the gate 404s rather than rendering a noindex page — a noindex page still
// costs crawl budget on a site where Google spends only ~10% of crawls on discovery.
export const revalidate = 3600

function describe(detail: CityDishDetail): string {
  const best = detail.places[0]
  const opener = `${detail.name} bij ${detail.placeCount} snackplekken in ${detail.city.name}, beoordeeld in ${detail.reviewCount} reviews.`
  return best
    ? `${opener} ${best.name} scoort het hoogst met gemiddeld ${best.avgRating.toFixed(1).replace('.', ',')} ★.`
    : opener
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ stad: string; gerecht: string }>
}): Promise<Metadata> {
  const { stad, gerecht } = await params
  const detail = await getCityDishDetail(stad, gerecht)
  if (!detail) return { title: 'Niet gevonden' }

  const title = `${detail.name} in ${detail.city.name}: hoogst beoordeeld`
  const description = describe(detail)
  const image = detail.places.find((place) => place.photoUrl)?.photoUrl

  return {
    title: { absolute: `${title} | SnackSpot` },
    description,
    alternates: { canonical: `/snackplekken/${detail.city.slug}/${detail.slug}` },
    openGraph: {
      type: 'website',
      title,
      description,
      locale: 'nl_NL',
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

export default async function CityDishPage({
  params,
}: {
  params: Promise<{ stad: string; gerecht: string }>
}) {
  const { stad, gerecht } = await params
  const detail = await getCityDishDetail(stad, gerecht)

  if (!detail) notFound()

  const appUrl = getSiteUrl()
  const dishLabel = detail.name.toLowerCase()
  const nationalHref = await getDishPageHref(detail.key)

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${detail.name} in ${detail.city.name}: hoogst beoordeeld`,
    numberOfItems: detail.places.length,
    itemListElement: detail.places.map((place, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Restaurant',
        name: place.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: place.address,
          addressLocality: detail.city.name,
        },
        url: `${appUrl}/place/${place.id}`,
        aggregateRating: {
          '@type': 'AggregateRating',
          // Scoped to this dish, which is the claim the page actually makes.
          ratingValue: place.avgRating,
          reviewCount: place.reviewCount,
          bestRating: 5,
          worstRating: 1,
        },
      },
    })),
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <TrackView event="dish_page_view" source="city" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'Snackplekken', path: '/snackplekken' },
          { name: detail.city.name, path: `/snackplekken/${detail.city.slug}` },
          { name: detail.name, path: `/snackplekken/${detail.city.slug}/${detail.slug}` },
        ]}
      />

      <header className="max-w-3xl">
        <Link
          href={`/snackplekken/${detail.city.slug}`}
          className="text-sm font-semibold text-snack-primary hover:underline"
        >
          ← Alle snackplekken in {detail.city.name}
        </Link>
        <h1 className="mt-3 font-heading text-3xl font-bold text-snack-text md:text-5xl">
          {detail.name} in {detail.city.name}: hoogst beoordeeld
        </h1>
        <p className="mt-4 text-base leading-7 text-snack-muted md:text-lg">{describe(detail)}</p>
        <p className="mt-2 text-sm text-snack-muted">
          Gemiddeld cijfer voor {dishLabel} in {detail.city.name}:{' '}
          <span className="font-semibold text-snack-text">★ {detail.avgRating.toFixed(1).replace('.', ',')}</span>
        </p>
        {nationalHref && (
          <p className="mt-2 text-sm">
            <Link href={nationalHref} className="font-semibold text-snack-primary hover:underline">
              Bekijk {dishLabel} in heel Nederland
            </Link>
          </p>
        )}
      </header>

      <section className="mt-10" aria-labelledby="ranglijst">
        <h2 id="ranglijst" className="font-heading text-xl font-semibold text-snack-text">
          Ranglijst voor {dishLabel} in {detail.city.name}
        </h2>
        <p className="mt-1 text-sm text-snack-muted">
          Gerangschikt op het cijfer voor dit gerecht, niet op het totaalcijfer van de snackplek.
        </p>

        <ol className="mt-5 space-y-4">
          {detail.places.map((place, index) => (
            <li key={place.id}>
              <Link
                href={`/place/${place.id}`}
                className="flex gap-4 rounded-2xl border border-snack-border bg-snack-background p-4 shadow-sm transition hover:border-snack-primary/40"
              >
                {place.photoUrl ? (
                  <img
                    src={place.photoUrl}
                    alt={`${detail.name} bij ${place.name} in ${detail.city.name}`}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    className="h-24 w-24 flex-shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-xl bg-snack-surface text-2xl">
                    🍟
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">
                    #{index + 1}
                  </p>
                  <h3 className="mt-0.5 font-heading text-lg font-semibold text-snack-text">
                    {place.name}
                  </h3>
                  <p className="truncate text-sm text-snack-muted">{place.address}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-semibold text-snack-text">
                      ★ {place.avgRating.toFixed(1).replace('.', ',')}
                    </span>
                    <span className="text-snack-muted">
                      {place.reviewCount} {place.reviewCount === 1 ? 'review' : 'reviews'} van dit
                      gerecht
                    </span>
                  </div>

                  {place.quote && (
                    <p className="mt-2 text-sm italic leading-6 text-snack-muted">
                      “{place.quote}”
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 rounded-2xl border border-snack-border bg-snack-surface p-6">
        <h2 className="font-heading text-lg font-semibold text-snack-text">
          Zelf {dishLabel} gegeten in {detail.city.name}?
        </h2>
        <p className="mt-2 text-sm leading-6 text-snack-muted">
          De volgorde komt uit reviews van bezoekers. Schrijf een review, dan telt jouw cijfer
          mee.
        </p>
        <Link href="/add-review" className="btn-primary mt-4 inline-flex text-sm">
          Schrijf een review
        </Link>
      </section>
    </div>
  )
}
