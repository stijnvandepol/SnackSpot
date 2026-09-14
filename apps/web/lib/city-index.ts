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
 * Both insert paths in lib/place-service.ts now write `city` — the provider path from the
 * Nominatim response, the manual path via extractCity() — and migration 038 backfilled the
 * rows created before that. Rows with a null or blank city are still excluded, so the
 * failure mode remains a place missing from a city page, never a wrong or empty page.
 */

// The quality gate. GSC data from Aug 2026 showed 32 places spread over 22 cities, 19 of them
// holding a single place — publishing a page each would have been 19 thin pages on a site
// already carrying 67% thin URLs. Deliberately strict: at the time of writing only Eindhoven
// (3 places, 15 reviews) clears it. Tune here as the corpus grows.
export const CITY_PAGE_MIN_PLACES = 3
export const CITY_PAGE_MIN_REVIEWS = 8

/** How many dishes the "wat bestellen ze hier" section shows. */
const CITY_TOP_DISH_LIMIT = 6

// The gate for /snackbars/[stad]/[gerecht]. Deliberately stricter per page than the city
// gate: a dish ranking is only worth reading when several places can be compared on the
// same dish, which is the whole point of the page. Expect zero qualifying dishes until the
// corpus grows — a dish below this has no page, exactly like a city below the city gate.
export const CITY_DISH_PAGE_MIN_PLACES = 3
export const CITY_DISH_PAGE_MIN_REVIEWS = 5

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
  /** Dishes in this city that clear the dish gate and therefore have their own page. */
  dishPages: CityDishSummary[]
}

export interface CityDishSummary {
  /** URL segment, derived from the display name. */
  slug: string
  /** Display name, e.g. "Frikandel speciaal". */
  name: string
  /** Lowercased, trimmed grouping key — how the dish is matched in SQL. */
  key: string
  placeCount: number
  reviewCount: number
  avgRating: number
}

export interface CityDishPlace {
  id: string
  name: string
  address: string
  avgRating: number
  reviewCount: number
  photoUrl: string | null
  /** A short excerpt from the most recent review of this dish here. */
  quote: string | null
}

export interface CityDishDetail extends CityDishSummary {
  city: CitySummary
  places: CityDishPlace[]
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

interface CityDishAggregateRow {
  dish: string
  dish_key: string
  place_count: number
  review_count: number
  avg_rating: number
}

interface CityDishPlaceRow {
  id: string
  name: string
  address: string
  avg_rating: number
  review_count: number
  quote: string | null
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

/**
 * Slug of the city landing page a place belongs to, or null when that city has no page.
 *
 * Checked against the same gate the pages use, so a place page can only ever link to a
 * /snackbars/[stad] URL that exists — a city below the gate 404s by design.
 */
export async function getCityPageSlug(city: string | null | undefined): Promise<string | null> {
  if (!city || city.trim() === '') return null
  const slug = citySlug(city)
  const cities = await getQualifyingCities()
  return cities.some((candidate) => candidate.slug === slug) ? slug : null
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

  const [photoByPlace, dishPages] = await Promise.all([
    getPhotoByPlace(placeRows.map((row) => row.id)),
    getQualifyingCityDishes(city),
  ])
  const dishByPlace = new Map(placeDishRows.map((row) => [row.place_id, row.dish]))

  return {
    ...summary,
    dishPages,
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
 * Dishes in a city that clear the dish gate, most-reviewed first.
 *
 * Grouping on LOWER(TRIM(dish_name)) folds "Frikandel speciaal" and "frikandel speciaal"
 * into one dish; MIN() picks a stable display spelling from the group. As with the city
 * gate the threshold is applied in TypeScript rather than a HAVING clause, so it stays
 * unit-testable and the two gates read the same way.
 *
 * Takes a city *name*, not a slug — callers already hold the resolved CitySummary.
 */
export async function getQualifyingCityDishes(city: string): Promise<CityDishSummary[]> {
  const rows = await prisma.$queryRaw<CityDishAggregateRow[]>`
    SELECT
      MIN(TRIM(r.dish_name))                          AS dish,
      LOWER(TRIM(r.dish_name))                        AS dish_key,
      COUNT(DISTINCT r.place_id)::int                 AS place_count,
      COUNT(*)::int                                   AS review_count,
      ROUND(AVG(r.rating_overall)::numeric, 1)::float AS avg_rating
    FROM reviews r
    JOIN places p ON p.id = r.place_id
    WHERE p.city = ${city}
      AND r.status = 'PUBLISHED'
      AND r.dish_name IS NOT NULL
      AND LENGTH(TRIM(r.dish_name)) > 0
    GROUP BY LOWER(TRIM(r.dish_name))
    ORDER BY COUNT(*) DESC, AVG(r.rating_overall) DESC
  `

  return rows
    .filter(
      (row) =>
        row.place_count >= CITY_DISH_PAGE_MIN_PLACES &&
        row.review_count >= CITY_DISH_PAGE_MIN_REVIEWS,
    )
    .map((row) => ({
      // citySlug() is a general "text → URL segment" helper despite the name; reusing it
      // keeps city and dish segments normalised the same way.
      slug: citySlug(row.dish),
      name: row.dish,
      key: row.dish_key,
      placeCount: row.place_count,
      reviewCount: row.review_count,
      avgRating: row.avg_rating,
    }))
    // A slug collision would make one of the two pages unreachable; keeping the first
    // (most-reviewed) is deterministic and matches what the city page links to.
    .filter((dish, index, all) => all.findIndex((d) => d.slug === dish.slug) === index)
}

/**
 * One dish in one city: every place that serves it, ranked on that dish alone.
 *
 * This is the page Google Maps and the friet-only directories cannot produce — the ranking
 * is per dish, not per venue, which is what `reviews.dish_name` makes possible.
 *
 * Returns null when the city is below the city gate, the slug is unknown, or the dish is
 * below the dish gate. All three are a 404 for the same reason: there is nothing to read.
 */
export async function getCityDishDetail(
  slug: string,
  dishSlug: string,
): Promise<CityDishDetail | null> {
  const city = (await getQualifyingCities()).find((candidate) => candidate.slug === slug)
  if (!city) return null

  const dish = (await getQualifyingCityDishes(city.name)).find(
    (candidate) => candidate.slug === dishSlug,
  )
  if (!dish) return null

  const placeRows = await prisma.$queryRaw<CityDishPlaceRow[]>`
    SELECT
      p.id,
      p.name,
      p.address,
      ROUND(AVG(r.rating_overall)::numeric, 1)::float AS avg_rating,
      COUNT(*)::int                                   AS review_count,
      -- Newest review text for this dish here, as a short pull quote.
      (ARRAY_AGG(r.text ORDER BY r.created_at DESC))[1] AS quote
    FROM reviews r
    JOIN places p ON p.id = r.place_id
    WHERE p.city = ${city.name}
      AND r.status = 'PUBLISHED'
      AND LOWER(TRIM(r.dish_name)) = ${dish.key}
    GROUP BY p.id, p.name, p.address
    ORDER BY avg_rating DESC NULLS LAST, review_count DESC, p.name ASC
  `

  const photoByPlace = await getPhotoByPlace(
    placeRows.map((row) => row.id),
    dish.key,
  )

  return {
    ...dish,
    city,
    places: placeRows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      avgRating: row.avg_rating,
      reviewCount: row.review_count,
      photoUrl: photoByPlace.get(row.id) ?? null,
      quote: truncate(row.quote, 180),
    })),
  }
}

/** Trims review text to a readable pull quote without cutting mid-word. */
function truncate(text: string | null, maxLength: number): string | null {
  if (!text) return null
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length === 0) return null
  if (normalized.length <= maxLength) return normalized
  const cut = normalized.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * Newest published photo per place, in one query. Ordering by createdAt desc means the first
 * row seen for a place is its most recent photo, which avoids a per-place query.
 *
 * Pass `dishKey` to restrict the photo to reviews of that dish, so a dish page shows the
 * dish rather than whatever was posted there most recently.
 */
async function getPhotoByPlace(
  placeIds: string[],
  dishKey?: string,
): Promise<Map<string, string>> {
  if (placeIds.length === 0) return new Map()

  const reviews = await prisma.review.findMany({
    where: {
      placeId: { in: placeIds },
      status: ReviewStatus.PUBLISHED,
      reviewPhotos: { some: {} },
      ...(dishKey ? { dishName: { equals: dishKey, mode: 'insensitive' as const } } : {}),
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
