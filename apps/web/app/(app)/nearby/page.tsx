import Link from 'next/link'
import { NearbyClient } from './nearby-client'
import { searchPopular, type PlaceRow } from '@/lib/place-search'
import { getQualifyingCities, type CitySummary } from '@/lib/city-index'
import { logger } from '@/lib/logger'

// This page had the worst ratio on the site: 208 impressions at an average position of
// 13.28 with a 0.48% CTR, for a route whose entire content was behind a 'use client'
// boundary *and* a geolocation prompt. A crawler saw nothing; a visitor who declined
// location access saw nothing either. The city and place lists below fix both at once.
export const dynamic = 'force-dynamic'

const POPULAR_PLACE_LIMIT = 10

async function getPopularPlaces(): Promise<PlaceRow[]> {
  try {
    const places = await searchPopular(POPULAR_PLACE_LIMIT)
    return places.filter((place) => place.review_count > 0)
  } catch (error) {
    logger.error({ err: error }, 'Failed to load popular places for /nearby')
    return []
  }
}

async function getCities(): Promise<CitySummary[]> {
  try {
    return await getQualifyingCities()
  } catch (error) {
    logger.error({ err: error }, 'Failed to load cities for /nearby')
    return []
  }
}

export default async function NearbyPage() {
  const [places, cities] = await Promise.all([getPopularPlaces(), getCities()])

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-snack-text">
          Snackbars bij jou in de buurt
        </h1>
        <p className="text-sm text-snack-muted">
          Zoek op de kaart naar snackbars, cafetaria’s en kleine eettentjes in de buurt — of
          begin hieronder bij een stad.
        </p>
      </div>

      <NearbyClient />

      {cities.length > 0 && (
        <nav className="mt-10" aria-labelledby="begin-bij-een-stad">
          <h2
            id="begin-bij-een-stad"
            className="text-lg font-heading font-semibold text-snack-text"
          >
            Begin bij een stad
          </h2>
          <p className="text-xs text-snack-muted">
            Geen locatie delen? Deze steden hebben genoeg reviews voor een eigen ranglijst.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {cities.map((city) => (
              <li key={city.slug}>
                <Link
                  href={`/snackbars/${city.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-snack-border bg-snack-surface px-3 py-1.5 text-sm transition hover:border-snack-primary/40"
                >
                  <span className="font-medium text-snack-text">{city.name}</span>
                  <span className="text-snack-muted">{city.placeCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {places.length > 0 && (
        <section className="mt-10 space-y-3" aria-labelledby="vaakst-beoordeeld">
          <h2
            id="vaakst-beoordeeld"
            className="text-lg font-heading font-semibold text-snack-text"
          >
            Vaakst beoordeeld
          </h2>
          <ol className="space-y-2">
            {places.map((place) => (
              <li key={place.id}>
                <Link
                  href={`/place/${place.id}?from=nearby`}
                  className="flex items-baseline justify-between gap-3 rounded-xl border border-snack-border bg-snack-surface px-4 py-3 transition hover:border-snack-primary/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-snack-text">
                      {place.name}
                    </span>
                    <span className="block truncate text-xs text-snack-muted">{place.address}</span>
                  </span>
                  <span className="flex-shrink-0 text-sm text-snack-muted">
                    {place.avg_rating !== null && (
                      <span className="font-semibold text-snack-text">
                        ★ {place.avg_rating.toFixed(1)}
                      </span>
                    )}{' '}
                    · {place.review_count}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
