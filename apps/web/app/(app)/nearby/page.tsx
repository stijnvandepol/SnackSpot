import Link from 'next/link'
import { NearbyClient } from './nearby-client'
import { CityRail } from '@/components/city-rail'
import { searchPopular, type PlaceRow } from '@/lib/place-search'
import { getQualifyingCities, type CitySummary } from '@/lib/city-index'
import { logger } from '@/lib/logger'

// This page had the worst ratio on the site: 208 impressions at an average position of
// 13.28 with a 0.48% CTR, for a route whose entire content sat behind a 'use client'
// boundary *and* a geolocation prompt. A crawler saw nothing; a visitor who declined
// location access saw nothing either.
//
// Unlike /search, the server content here is the only content in that state, so the place
// list stays — kept short so it reads as a fallback rather than a second page.
export const dynamic = 'force-dynamic'

const POPULAR_PLACE_LIMIT = 8

async function getPopularPlaces(): Promise<PlaceRow[]> {
  try {
    const places = await searchPopular(POPULAR_PLACE_LIMIT)
    // searchPopular LEFT JOINs, so places without any published review come back too.
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
      <h1 className="font-heading text-xl font-bold leading-snug text-snack-text sm:text-2xl">
        Eettentjes bij jou in de buurt
      </h1>
      <p className="mt-1 text-sm text-snack-muted">
        Zoek op de kaart, of begin bij een stad als je je locatie liever niet deelt.
      </p>

      <CityRail cities={cities} className="mt-4" />

      <div className="mt-5">
        <NearbyClient />
      </div>

      {places.length > 0 && (
        <section className="mt-8" aria-labelledby="vaakst-beoordeeld">
          <h2
            id="vaakst-beoordeeld"
            className="font-heading text-base font-semibold text-snack-text"
          >
            Vaakst beoordeeld
          </h2>
          <ol className="mt-3 space-y-2">
            {places.map((place) => (
              <li key={place.id}>
                <Link
                  href={`/place/${place.id}?from=nearby`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-snack-border bg-snack-surface px-4 py-3 transition hover:border-snack-primary/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-snack-text">
                      {place.name}
                    </span>
                    <span className="block truncate text-xs text-snack-muted">{place.address}</span>
                  </span>
                  <span className="flex-shrink-0 whitespace-nowrap text-sm text-snack-muted">
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
