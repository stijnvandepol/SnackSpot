import { cache } from 'react'
import { prisma } from '@/lib/db'
import { buildCacheKey, getCachedJson, setCachedJson } from '@/lib/cache'
import {
  CITY_DISH_PAGE_MIN_PLACES,
  CITY_DISH_PAGE_MIN_REVIEWS,
  citySlug,
  getPhotoByPlace,
  getQualifyingCities,
} from '@/lib/city-index'

/**
 * National dish pages: /gerechten/[gerecht].
 *
 * The city-dish pages answer "beste frikandel speciaal in Eindhoven". Nothing answered the
 * query without a city — "frikandel speciaal review", "waar eet je de beste kapsalon" — which
 * is where most dish searches start. This page ranks every reviewed address for one dish,
 * across cities, on that dish's rating alone.
 *
 * Same quality principle as the city-dish gate, for the same reason: the page claims to
 * compare places, so it needs at least two of them, and three reviews so a single opinion
 * cannot carry the heading.
 */
export const DISH_PAGE_MIN_PLACES = 2
export const DISH_PAGE_MIN_REVIEWS = 3

/** Places listed per dish page. Beyond this the list stops being a recommendation. */
const DISH_PAGE_PLACE_LIMIT = 30

const QUALIFYING_DISHES_TTL_SECONDS = 600

export interface DishSummary {
  slug: string
  name: string
  /** Lowercased, trimmed grouping key — how the dish is matched in SQL. */
  key: string
  placeCount: number
  cityCount: number
  reviewCount: number
  avgRating: number
}

export interface DishPlace {
  id: string
  name: string
  address: string
  city: string | null
  avgRating: number
  reviewCount: number
  photoUrl: string | null
  quote: string | null
}

export interface DishCity {
  name: string
  placeCount: number
  reviewCount: number
  /** Set when /eettentjes/[stad]/[gerecht] exists for this city, so the link never 404s. */
  cityDishHref: string | null
}

export interface DishDetail extends DishSummary {
  places: DishPlace[]
  cities: DishCity[]
}

interface DishAggregateRow {
  dish: string
  dish_key: string
  place_count: number
  city_count: number
  review_count: number
  avg_rating: number
}

interface DishPlaceRow {
  id: string
  name: string
  address: string
  city: string | null
  avg_rating: number
  review_count: number
  quote: string | null
}

interface DishCityRow {
  city: string
  place_count: number
  review_count: number
}

/** Pure gate + slug step, split out so it is testable without a database. */
export function toQualifyingDishes(rows: DishAggregateRow[]): DishSummary[] {
  return rows
    .filter((row) => row.place_count >= DISH_PAGE_MIN_PLACES && row.review_count >= DISH_PAGE_MIN_REVIEWS)
    .map((row) => ({
      slug: citySlug(row.dish),
      name: row.dish,
      key: row.dish_key,
      placeCount: row.place_count,
      cityCount: row.city_count,
      reviewCount: row.review_count,
      avgRating: row.avg_rating,
    }))
    .filter((dish) => dish.slug.length > 0)
    // Two spellings that slug the same would make one page unreachable; the most-reviewed wins.
    .filter((dish, index, all) => all.findIndex((d) => d.slug === dish.slug) === index)
}

/** Dishes that clear the gate, most-reviewed first. Cached: it also drives internal links. */
export const getQualifyingDishes = cache(async (): Promise<DishSummary[]> => {
  const cacheKey = buildCacheKey('qualifying-dishes', 'v1')
  const cached = await getCachedJson<DishSummary[]>(cacheKey)
  if (cached) return cached

  const rows = await prisma.$queryRaw<DishAggregateRow[]>`
    SELECT
      MIN(TRIM(r.dish_name))                          AS dish,
      LOWER(TRIM(r.dish_name))                        AS dish_key,
      COUNT(DISTINCT r.place_id)::int                 AS place_count,
      COUNT(DISTINCT NULLIF(TRIM(p.city), ''))::int   AS city_count,
      COUNT(*)::int                                   AS review_count,
      ROUND(AVG(r.rating_overall)::numeric, 1)::float AS avg_rating
    FROM reviews r
    JOIN places p ON p.id = r.place_id
    WHERE r.status = 'PUBLISHED'
      AND r.dish_name IS NOT NULL
      AND LENGTH(TRIM(r.dish_name)) > 0
    GROUP BY LOWER(TRIM(r.dish_name))
    ORDER BY COUNT(*) DESC, AVG(r.rating_overall) DESC
  `

  const dishes = toQualifyingDishes(rows)
  await setCachedJson(cacheKey, dishes, QUALIFYING_DISHES_TTL_SECONDS)
  return dishes
})

/** `/gerechten/<slug>` for a dish name, or null when that dish has no page. */
export async function getDishPageHref(dishName: string | null | undefined): Promise<string | null> {
  if (!dishName) return null
  const key = dishName.trim().toLowerCase()
  if (!key) return null
  const dish = (await getQualifyingDishes()).find((candidate) => candidate.key === key)
  return dish ? `/gerechten/${dish.slug}` : null
}

/** Lookup map for linking several dish names at once (place and city pages). */
export async function getDishPageHrefs(): Promise<Map<string, string>> {
  const dishes = await getQualifyingDishes()
  return new Map(dishes.map((dish) => [dish.key, `/gerechten/${dish.slug}`]))
}

/** Full page data, or null when the slug is unknown or below the gate (→ 404). */
export const getDishDetail = cache(async (slug: string): Promise<DishDetail | null> => {
  const dish = (await getQualifyingDishes()).find((candidate) => candidate.slug === slug)
  if (!dish) return null

  const [placeRows, cityRows, qualifyingCities] = await Promise.all([
    prisma.$queryRaw<DishPlaceRow[]>`
      SELECT
        p.id,
        p.name,
        p.address,
        NULLIF(TRIM(p.city), '')                        AS city,
        ROUND(AVG(r.rating_overall)::numeric, 1)::float AS avg_rating,
        COUNT(*)::int                                   AS review_count,
        (ARRAY_AGG(r.text ORDER BY r.created_at DESC))[1] AS quote
      FROM reviews r
      JOIN places p ON p.id = r.place_id
      WHERE r.status = 'PUBLISHED'
        AND LOWER(TRIM(r.dish_name)) = ${dish.key}
      GROUP BY p.id, p.name, p.address, p.city
      ORDER BY avg_rating DESC NULLS LAST, review_count DESC, p.name ASC
      LIMIT ${DISH_PAGE_PLACE_LIMIT}
    `,
    prisma.$queryRaw<DishCityRow[]>`
      SELECT
        TRIM(p.city)                    AS city,
        COUNT(DISTINCT p.id)::int       AS place_count,
        COUNT(*)::int                   AS review_count
      FROM reviews r
      JOIN places p ON p.id = r.place_id
      WHERE r.status = 'PUBLISHED'
        AND LOWER(TRIM(r.dish_name)) = ${dish.key}
        AND p.city IS NOT NULL AND TRIM(p.city) <> ''
      GROUP BY TRIM(p.city)
      ORDER BY COUNT(*) DESC, TRIM(p.city) ASC
    `,
    getQualifyingCities(),
  ])

  const photoByPlace = await getPhotoByPlace(
    placeRows.map((row) => row.id),
    dish.key,
  )
  const citySlugs = new Set(qualifyingCities.map((city) => city.slug))

  return {
    ...dish,
    places: placeRows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.city,
      avgRating: row.avg_rating,
      reviewCount: row.review_count,
      photoUrl: photoByPlace.get(row.id) ?? null,
      quote: pullQuote(row.quote, 160),
    })),
    cities: cityRows.map((row) => {
      const slug = citySlug(row.city)
      // Mirrors the city-dish gate in lib/city-index.ts, so the link only appears where the
      // page exists.
      const hasCityDishPage =
        citySlugs.has(slug) &&
        row.place_count >= CITY_DISH_PAGE_MIN_PLACES &&
        row.review_count >= CITY_DISH_PAGE_MIN_REVIEWS
      return {
        name: row.city,
        placeCount: row.place_count,
        reviewCount: row.review_count,
        cityDishHref: hasCityDishPage ? `/eettentjes/${slug}/${dish.slug}` : null,
      }
    }),
  }
})

function pullQuote(text: string | null, maxLength: number): string | null {
  if (!text) return null
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  if (normalized.length <= maxLength) return normalized
  const cut = normalized.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}
