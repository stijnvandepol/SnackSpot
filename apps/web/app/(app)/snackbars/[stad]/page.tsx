import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { cuisineLabel } from '@snackspot/shared'
import { getCityDetail, getQualifyingCities, type CityDetail } from '@/lib/city-index'
import { getSiteUrl } from '@/lib/site-url'
import { safeJsonLd } from '@/lib/html'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'

// Matches app/sitemap.ts so the page and the sitemap age at the same rate.
export const revalidate = 3600

// Only cities past the quality gate get built. Anything else falls through to notFound()
// below — deliberately a 404 rather than a noindex page, because a noindex page still costs
// crawl budget on a site where Google already spends only ~10% of crawls on discovery.
export async function generateStaticParams() {
  const cities = await getQualifyingCities()
  return cities.map((city) => ({ stad: city.slug }))
}

function describe(city: CityDetail): string {
  const dishes = city.topDishes.slice(0, 2).map((dish) => dish.name)
  const opener = `${city.placeCount} snackbars in ${city.name}, beoordeeld in ${city.reviewCount} fotoreviews door mensen die er echt gegeten hebben.`
  return dishes.length > 0
    ? `${opener} Ontdek wat ze hier het vaakst bestellen, van ${dishes.join(' tot ')}.`
    : `${opener} Zie per zaak de cijfers, de foto's en wat je het beste kunt bestellen.`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ stad: string }>
}): Promise<Metadata> {
  const { stad } = await params
  const city = await getCityDetail(stad)
  if (!city) return { title: 'Niet gevonden' }

  const title = `De beste snackbars in ${city.name}`
  const description = describe(city)
  const image = city.places.find((place) => place.photoUrl)?.photoUrl

  return {
    title: { absolute: `${title} — SnackSpot` },
    description,
    alternates: { canonical: `/snackbars/${city.slug}` },
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

export default async function CityPage({ params }: { params: Promise<{ stad: string }> }) {
  const { stad } = await params
  const city = await getCityDetail(stad)

  if (!city) notFound()

  const appUrl = getSiteUrl()
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `De beste snackbars in ${city.name}`,
    numberOfItems: city.places.length,
    itemListElement: city.places.map((place, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Restaurant',
        name: place.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: place.address,
          addressLocality: city.name,
        },
        url: `${appUrl}/place/${place.id}`,
        ...(place.avgRating !== null && place.reviewCount > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: place.avgRating,
                reviewCount: place.reviewCount,
                bestRating: 5,
                worstRating: 1,
              },
            }
          : {}),
      },
    })),
  }

  return (
    <div lang="nl" className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Snackbars', path: '/snackbars' },
          { name: city.name, path: `/snackbars/${city.slug}` },
        ]}
      />

      <header className="max-w-3xl">
        <Link href="/snackbars" className="text-sm font-semibold text-snack-primary hover:underline">
          ← Alle steden
        </Link>
        <h1 className="mt-3 font-heading text-3xl font-bold text-snack-text md:text-5xl">
          De beste snackbars in {city.name}
        </h1>
        <p className="mt-4 text-base leading-7 text-snack-muted md:text-lg">{describe(city)}</p>
      </header>

      {city.topDishes.length > 0 && (
        <section className="mt-10" aria-labelledby="wat-bestellen-ze">
          <h2 id="wat-bestellen-ze" className="font-heading text-xl font-semibold text-snack-text">
            Wat bestellen ze in {city.name}?
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {city.topDishes.map((dish) => (
              <li
                key={dish.name}
                className="rounded-full border border-snack-border bg-snack-surface px-3.5 py-1.5 text-sm"
              >
                <span className="font-semibold text-snack-text">{dish.name}</span>
                <span className="ml-2 text-snack-muted">
                  {dish.count}× · ★ {dish.avgRating.toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10" aria-labelledby="alle-zaken">
        <h2 id="alle-zaken" className="font-heading text-xl font-semibold text-snack-text">
          Alle {city.placeCount} zaken in {city.name}
        </h2>
        <ol className="mt-4 space-y-4">
          {city.places.map((place, index) => (
            <li key={place.id}>
              <Link
                href={`/place/${place.id}`}
                className="flex gap-4 rounded-2xl border border-snack-border bg-white p-4 shadow-sm transition hover:border-snack-primary/40"
              >
                {place.photoUrl ? (
                  <img
                    src={place.photoUrl}
                    alt=""
                    loading="lazy"
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
                    {place.avgRating !== null && (
                      <span className="font-semibold text-snack-text">
                        ★ {place.avgRating.toFixed(1)}
                      </span>
                    )}
                    <span className="text-snack-muted">
                      {place.reviewCount} {place.reviewCount === 1 ? 'review' : 'reviews'}
                    </span>
                    {cuisineLabel(place.cuisine) && (
                      <span className="text-snack-muted">{cuisineLabel(place.cuisine)}</span>
                    )}
                  </div>

                  {place.topDish && (
                    <p className="mt-2 text-sm text-snack-text">
                      <span className="text-snack-muted">Meest besteld:</span>{' '}
                      <span className="font-semibold">{place.topDish}</span>
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
          Ken jij een betere snackbar in {city.name}?
        </h2>
        <p className="mt-2 text-sm leading-6 text-snack-muted">
          Deze lijst komt volledig uit reviews van bezoekers. Mis je een zaak, of ben je het niet
          eens met de volgorde? Plaats je eigen fotoreview en de ranglijst past zich aan.
        </p>
        <Link href="/add-review" className="btn-primary mt-4 inline-flex text-sm">
          Schrijf een review
        </Link>
      </section>
    </div>
  )
}
