import { ReviewStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { photoVariantUrl } from '@/lib/photo-url'

/**
 * City aggregation for the /snackbars landing pages.
 *
 * Source of truth is `places.city` (migration 030), which is indexed and correctable from
 * the admin UI. Deriving the city from `address` was rejected: it cannot use the index, and
 * a wrong value would need a heuristic change rather than an admin edit.
 *
 * Note `places.city` is only written by migration 030's backfill and by admin edits — nothing
 * populates it on place creation, so new places are invisible here until an admin sets it.
 * Rows with a null or blank city are excluded, so the failure mode is a place missing from a
 * city page, never a wrong or empty page.
 */

// The quality gate. GSC data from Aug 2026 showed 32 places spread over 22 cities, 19 of them
// holding a single place — publishing a page each would have been 19 thin pages on a site
// already carrying 67% thin URLs. Deliberately strict: at the time of writing only Eindhoven
// (3 places, 15 reviews) clears it. Tune here as the corpus grows.
export const CITY_PAGE_MIN_PLACES = 3
export const CITY_PAGE_MIN_REVIEWS = 8

/** How many dishes the "wat bestellen ze hier" section shows. */
const CITY_TOP_DISH_LIMIT = 6

export interface CitySummary {
  slug: string
  name: string
  placeCount: number
  reviewCount: number
}

export interface CityPlace {
  id: string
  name: string
  address: string
  cuisine: string | null
  avgRating: number | null
  reviewCount: number
  photoUrl: string | null
  topDish: string | null
}

export interface CityDish {
  name: string
  count: number
  avgRating: number
}

export interface CityDetail extends CitySummary {
  places: CityPlace[]
  topDishes: CityDish[]
}

/**
 * URL-safe slug for a city name. Strips diacritics so "Chorzów" and "Chorzow" resolve to the
 * same page, and collapses everything else to single hyphens.
 */
export function citySlug(city: string): string {
  return city
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface CityAggregateRow {
  city: string
  place_count: number
  review_count: number
}

interface CityPlaceRow {
  id: string
  name: string
  address: string
  cuisine: string | null
  avg_rating: number | null
  review_count: number
}

interface CityDishRow {
  dish: string
  review_count: number
  avg_rating: number
}

interface PlaceDishRow {
  place_id: string
  dish: string
}

/**
 * Cities that clear the quality gate, best-stocked first.
 *
 * The grouping runs in SQL; the threshold is applied here rather than in a HAVING clause so
 * the gate stays unit-testable. The number of distinct cities is small enough that filtering
 * in memory costs nothing.
 */
export async function getQualifyingCities(): Promise<CitySummary[]> {
  const rows = await prisma.$queryRaw<CityAggregateRow[]>`
    SELECT
      p.city                     AS city,
      COUNT(DISTINCT p.id)::int  AS place_count,
      COUNT(r.id)::int           AS review_count
    FROM places p
    JOIN reviews r ON r.place_id = p.id AND r.status = 'PUBLISHED'
    WHERE p.city IS NOT NULL AND TRIM(p.city) <> ''
    GROUP BY p.city
    ORDER BY COUNT(r.id) DESC, p.city ASC
  `

  return rows
    .filter(
      (row) =>
        row.place_count >= CITY_PAGE_MIN_PLACES && row.review_count >= CITY_PAGE_MIN_REVIEWS,
    )
    .map((row) => ({
      slug: citySlug(row.city),
      name: row.city,
      placeCount: row.place_count,
      reviewCount: row.review_count,
    }))
}

/** Full page data, or null when the slug is unknown or the city is below the gate. */
export async function getCityDetail(slug: string): Promise<CityDetail | null> {
  const summary = (await getQualifyingCities()).find((city) => city.slug === slug)
  if (!summary) return null

  const city = summary.name

  const [placeRows, dishRows, placeDishRows] = await Promise.all([
    prisma.$queryRaw<CityPlaceRow[]>`
      SELECT
        p.id,
        p.name,
        p.address,
        p.cuisine,
        ROUND(AVG(r.rating_overall)::numeric, 1)::float AS avg_rating,
        COUNT(r.id)::int                                AS review_count
      FROM places p
      JOIN reviews r ON r.place_id = p.id AND r.status = 'PUBLISHED'
      WHERE p.city = ${city}
      GROUP BY p.id, p.name, p.address, p.cuisine
      ORDER BY avg_rating DESC NULLS LAST, review_count DESC, p.name ASC
    `,
    // What the city as a whole orders — the aggregate Google Maps cannot reproduce.
    prisma.$queryRaw<CityDishRow[]>`
      SELECT
        MIN(TRIM(r.dish_name))                          AS dish,
        COUNT(*)::int                                   AS review_count,
        ROUND(AVG(r.rating_overall)::numeric, 1)::float AS avg_rating
      FROM reviews r
      JOIN places p ON p.id = r.place_id
      WHERE p.city = ${city}
        AND r.status = 'PUBLISHED'
        AND r.dish_name IS NOT NULL
        AND LENGTH(TRIM(r.dish_name)) > 0
      GROUP BY LOWER(TRIM(r.dish_name))
      ORDER BY review_count DESC, avg_rating DESC
      LIMIT ${CITY_TOP_DISH_LIMIT}
    `,
    // Single most-reviewed dish per place, ranked in SQL so this stays one query.
    prisma.$queryRaw<PlaceDishRow[]>`
      SELECT place_id, dish
      FROM (
        SELECT
          r.place_id,
          MIN(TRIM(r.dish_name)) AS dish,
          ROW_NUMBER() OVER (
            PARTITION BY r.place_id
            ORDER BY COUNT(*) DESC, AVG(r.rating_overall) DESC
          ) AS rank
        FROM reviews r
        JOIN places p ON p.id = r.place_id
        WHERE p.city = ${city}
          AND r.status = 'PUBLISHED'
          AND r.dish_name IS NOT NULL
          AND LENGTH(TRIM(r.dish_name)) > 0
        GROUP BY r.place_id, LOWER(TRIM(r.dish_name))
      ) ranked
      WHERE rank = 1
    `,
  ])

  const photoByPlace = await getPhotoByPlace(placeRows.map((row) => row.id))
  const dishByPlace = new Map(placeDishRows.map((row) => [row.place_id, row.dish]))

  return {
    ...summary,
    places: placeRows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      cuisine: row.cuisine,
      avgRating: row.avg_rating,
      reviewCount: row.review_count,
      photoUrl: photoByPlace.get(row.id) ?? null,
      topDish: dishByPlace.get(row.id) ?? null,
    })),
    topDishes: dishRows.map((row) => ({
      name: row.dish,
      count: row.review_count,
      avgRating: row.avg_rating,
    })),
  }
}

/**
 * Newest published photo per place, in one query. Ordering by createdAt desc means the first
 * row seen for a place is its most recent photo, which avoids a per-place query.
 */
async function getPhotoByPlace(placeIds: string[]): Promise<Map<string, string>> {
  if (placeIds.length === 0) return new Map()

  const reviews = await prisma.review.findMany({
    where: {
      placeId: { in: placeIds },
      status: ReviewStatus.PUBLISHED,
      reviewPhotos: { some: {} },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      placeId: true,
      reviewPhotos: {
        orderBy: { sortOrder: 'asc' },
        take: 1,
        select: { photo: { select: { variants: true } } },
      },
    },
  })

  const photoByPlace = new Map<string, string>()
  for (const review of reviews) {
    if (photoByPlace.has(review.placeId)) continue
    const variants = review.reviewPhotos[0]?.photo.variants
    const url = photoVariantUrl(variants as Record<string, string> | undefined, [
      'medium',
      'large',
      'thumb',
    ])
    if (url) photoByPlace.set(review.placeId, url)
  }
  return photoByPlace
}
