import Link from 'next/link'
import { SearchClient } from './search-client'
import { searchPopular, type PlaceRow } from '@/lib/place-search'
import { getQualifyingCities, type CitySummary } from '@/lib/city-index'
import { logger } from '@/lib/logger'

// Same reasoning as the homepage: this route used to be a single 'use client' component,
// so a crawler received an empty shell. The heading, the most-reviewed places and the
// city links below are rendered on the server; the search box stays interactive.
export const dynamic = 'force-dynamic'

/** How many places the crawlable list carries. Enough to be useful, short enough to skim. */
const POPULAR_PLACE_LIMIT = 12

async function getPopularPlaces(): Promise<PlaceRow[]> {
  try {
    const places = await searchPopular(POPULAR_PLACE_LIMIT)
    // searchPopular LEFT JOINs, so places without any published review come back too.
    return places.filter((place) => place.review_count > 0)
  } catch (error) {
    logger.error({ err: error }, 'Failed to load popular places for /search')
    return []
  }
}

async function getCities(): Promise<CitySummary[]> {
  try {
    return await getQualifyingCities()
  } catch (error) {
    logger.error({ err: error }, 'Failed to load cities for /search')
    return []
  }
}

export default async function SearchPage() {
  const [places, cities] = await Promise.all([getPopularPlaces(), getCities()])

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 space-y-1">
        <h1 className="text-2xl font-heading font-bold text-snack-text md:text-3xl">
          Ontdek snackbars en eettentjes
        </h1>
        <p className="text-sm text-snack-muted">
          Blader door zaken met recente fotoreviews, of zoek gericht op naam, gerecht of label.
        </p>
      </div>

      <SearchClient />

      {places.length > 0 && (
        <section className="mt-10 space-y-3" aria-labelledby="meest-beoordeeld">
          <div>
            <h2
              id="meest-beoordeeld"
              className="text-lg font-heading font-semibold text-snack-text"
            >
              Meest beoordeelde zaken
            </h2>
            <p className="text-xs text-snack-muted">
              De zaken waar de community de meeste fotoreviews over schreef.
            </p>
          </div>

          <ol className="space-y-2">
            {places.map((place) => (
              <li key={place.id}>
                <Link
                  href={`/place/${place.id}?from=search`}
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

      {cities.length > 0 && (
        <nav className="mt-10" aria-labelledby="zoek-per-stad">
          <h2 id="zoek-per-stad" className="text-lg font-heading font-semibold text-snack-text">
            Zoek per stad
          </h2>
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
    </div>
  )
}
