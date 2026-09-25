import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getDishDetail, type DishDetail } from '@/lib/dish-index'
import { getSiteUrl } from '@/lib/site-url'
import { safeJsonLd } from '@/lib/html'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'
import { TrackView } from '@/components/track-view'

// Hourly, like the city and city-dish pages and the sitemap, so the three age together.
// A dish below the gate 404s rather than rendering a thin noindex page.
export const revalidate = 3600

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** Unique per dish: built from this dish's own numbers and its top address. */
function describe(detail: DishDetail): string {
  const best = detail.places[0]
  const spread =
    detail.cityCount > 1
      ? `${plural(detail.placeCount, 'adres', 'adressen')} in ${detail.cityCount} steden`
      : plural(detail.placeCount, 'adres', 'adressen')
  const opener = `${detail.name} scoort gemiddeld ${detail.avgRating.toFixed(1)}★ over ${spread}, op basis van ${plural(detail.reviewCount, 'fotoreview', 'fotoreviews')}.`
  return best
    ? `${opener} ${best.name}${best.city ? ` in ${best.city}` : ''} staat bovenaan met ${best.avgRating.toFixed(1)}★.`
    : opener
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gerecht: string }>
}): Promise<Metadata> {
  const { gerecht } = await params
  const detail = await getDishDetail(gerecht)
  if (!detail) return { title: 'Niet gevonden' }

  // Written for "<gerecht> review" and "beste <gerecht>" searches, which is how people
  // look for a dish before they know which city or place to pick.
  const title = `${detail.name} review: waar is hij het lekkerst?`
  const description = describe(detail)
  const image = detail.places.find((place) => place.photoUrl)?.photoUrl

  return {
    title: { absolute: `${title} — SnackSpot` },
    description,
    alternates: { canonical: `/gerechten/${detail.slug}` },
    openGraph: { type: 'website', title, description, locale: 'nl_NL', ...(image ? { images: [image] } : {}) },
    twitter: { card: 'summary_large_image', title, description, ...(image ? { images: [image] } : {}) },
  }
}

export default async function DishPage({ params }: { params: Promise<{ gerecht: string }> }) {
  const { gerecht } = await params
  const detail = await getDishDetail(gerecht)
  if (!detail) notFound()

  const appUrl = getSiteUrl()
  const dishLabel = detail.name.toLowerCase()

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Waar eet je de beste ${dishLabel}?`,
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
          ...(place.city ? { addressLocality: place.city } : {}),
        },
        url: `${appUrl}/place/${place.id}`,
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: place.avgRating,
          reviewCount: place.reviewCount,
          bestRating: 5,
          worstRating: 1,
        },
      },
    })),
  }

  const cityLinks = detail.cities.filter((city) => city.cityDishHref)

  return (
    <div lang="nl" className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <TrackView event="dish_page_view" source="national" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Gerechten', path: '/gerechten' },
          { name: detail.name, path: `/gerechten/${detail.slug}` },
        ]}
      />

      <header className="max-w-3xl">
        <Link href="/gerechten" className="text-sm font-semibold text-snack-primary hover:underline">
          ← Alle gerechten
        </Link>
        <h1 className="mt-3 font-heading text-3xl font-bold text-snack-text md:text-5xl">
          Waar eet je de beste {dishLabel}?
        </h1>
        <p className="mt-4 text-base leading-7 text-snack-muted md:text-lg">{describe(detail)}</p>
      </header>

      {cityLinks.length > 0 && (
        <nav aria-label={`${detail.name} per stad`} className="mt-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">Per stad</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {cityLinks.map((city) => (
              <li key={city.name}>
                <Link
                  href={city.cityDishHref!}
                  className="inline-flex rounded-full border border-snack-border px-3 py-1.5 text-sm font-medium text-snack-text transition hover:border-snack-primary/40 hover:text-snack-primary"
                >
                  {detail.name} in {city.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <section className="mt-10" aria-labelledby="ranglijst">
        <h2 id="ranglijst" className="font-heading text-xl font-semibold text-snack-text">
          De ranglijst voor {dishLabel}
        </h2>
        <p className="mt-1 text-sm text-snack-muted">
          Gerangschikt op het cijfer voor dit gerecht alleen, niet op het cijfer van de zaak.
        </p>

        <ol className="mt-5 space-y-4">
          {detail.places.map((place, index) => (
            <li key={place.id}>
              <Link
                href={`/place/${place.id}`}
                className="flex gap-4 rounded-2xl border border-snack-border bg-snack-background p-4 shadow-sm transition hover:border-snack-primary/40"
              >
                {place.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- variants are pre-sized WebP from the worker
                  <img
                    src={place.photoUrl}
                    alt={`${detail.name} bij ${place.name}${place.city ? ` in ${place.city}` : ''}`}
                    width={96}
                    height={96}
                    decoding="async"
                    loading={index === 0 ? 'eager' : 'lazy'}
                    className="h-24 w-24 flex-shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div aria-hidden="true" className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-xl bg-snack-surface text-2xl">
                    🍟
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">#{index + 1}</p>
                  <h3 className="mt-0.5 font-heading text-lg font-semibold text-snack-text">{place.name}</h3>
                  <p className="truncate text-sm text-snack-muted">{place.address}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-semibold text-snack-text">★ {place.avgRating.toFixed(1)}</span>
                    <span className="text-snack-muted">
                      {plural(place.reviewCount, 'review', 'reviews')} van dit gerecht
                    </span>
                  </div>
                  {place.quote && (
                    <p className="mt-2 text-sm italic leading-6 text-snack-muted">“{place.quote}”</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 rounded-2xl border border-snack-border bg-snack-surface p-6">
        <h2 className="font-heading text-lg font-semibold text-snack-text">
          Weet jij een betere {dishLabel}?
        </h2>
        <p className="mt-2 text-sm leading-6 text-snack-muted">
          Deze lijst komt volledig uit reviews van bezoekers. Plaats een fotoreview, vul
          &quot;{detail.name}&quot; in als gerecht, en je stem telt mee.
        </p>
        <Link href="/add-review" className="btn-primary mt-4 inline-flex text-sm">
          Schrijf een review
        </Link>
      </section>
    </div>
  )
}
