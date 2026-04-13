import { prisma } from '@/lib/db'

export type PlaceRow = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  distance_m?: number
  avg_rating: number | null
  review_count: number
}

export type PlaceSearchResult = {
  data: PlaceRow[]
  pagination: { nextCursor: null; hasMore: false }
}

/**
 * Nearby search with a text filter.
 *
 * Matches places within `radius` metres whose name/address OR any published
 * dish name matches `q` (full-text first, ILIKE fallback for short terms).
 * DISTINCT ON(place_id) collapses multiple matching dish rows into one place.
 * Stats (avg_rating, review_count) are computed in a LATERAL subquery so we
 * don't need a second round-trip.
 */
export async function searchNearbyWithText(
  lat: number,
  lng: number,
  radius: number,
  q: string,
  limit: number,
): Promise<PlaceRow[]> {
  return prisma.$queryRaw<PlaceRow[]>`
    WITH candidates AS (
      SELECT DISTINCT ON (p.id)
        p.id,
        p.name,
        p.address,
        p.location,
        ST_Distance(p.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) AS distance_m
      FROM places p
      LEFT JOIN reviews dr ON dr.place_id = p.id
        AND dr.status = 'PUBLISHED'
        AND dr.dish_name IS NOT NULL
        AND (
          to_tsvector('english', COALESCE(dr.dish_name, '')) @@ plainto_tsquery('english', ${q})
          OR dr.dish_name ILIKE ${'%' + q + '%'}
        )
      WHERE ST_DWithin(
        p.location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radius}
      )
      AND (
        to_tsvector('english', p.name || ' ' || p.address) @@ plainto_tsquery('english', ${q})
        OR p.name ILIKE ${'%' + q + '%'}
        OR dr.id IS NOT NULL
      )
      ORDER BY p.id, distance_m
    )
    SELECT
      c.id,
      c.name,
      c.address,
      ST_Y(c.location::geometry) AS lat,
      ST_X(c.location::geometry) AS lng,
      c.distance_m,
      rs.avg_rating,
      rs.review_count
    FROM candidates c
    LEFT JOIN LATERAL (
      SELECT
        ROUND(AVG(r.rating_overall)::numeric, 1)::float AS avg_rating,
        COUNT(r.id)::int AS review_count
      FROM reviews r
      WHERE r.place_id = c.id AND r.status = 'PUBLISHED'
    ) rs ON TRUE
    ORDER BY c.distance_m
    LIMIT ${limit}
  `
}

/** Nearby search without a text filter — returns all places within `radius` metres ordered by distance. */
export async function searchNearby(
  lat: number,
  lng: number,
  radius: number,
  limit: number,
): Promise<PlaceRow[]> {
  return prisma.$queryRaw<PlaceRow[]>`
    WITH candidates AS (
      SELECT
        p.id,
        p.name,
        p.address,
        p.location,
        ST_Distance(p.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) AS distance_m
      FROM places p
      WHERE ST_DWithin(
        p.location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radius}
      )
      ORDER BY distance_m
      LIMIT ${limit}
    )
    SELECT
      c.id,
      c.name,
      c.address,
      ST_Y(c.location::geometry) AS lat,
      ST_X(c.location::geometry) AS lng,
      c.distance_m,
      rs.avg_rating,
      rs.review_count
    FROM candidates c
    LEFT JOIN LATERAL (
      SELECT
        ROUND(AVG(r.rating_overall)::numeric, 1)::float AS avg_rating,
        COUNT(r.id)::int AS review_count
      FROM reviews r
      WHERE r.place_id = c.id AND r.status = 'PUBLISHED'
    ) rs ON TRUE
    ORDER BY c.distance_m
  `
}

/**
 * Text-only search ranked by relevance (no spatial filter).
 *
 * Scores each place as the best of: ts_rank on name/address, ILIKE bonus (0.5),
 * and 80 % of the best dish-name rank across published reviews. DISTINCT ON(place_id)
 * with ORDER BY rank DESC picks the best-scoring row per place.
 */
export async function searchByText(
  q: string,
  limit: number,
): Promise<PlaceRow[]> {
  return prisma.$queryRaw<PlaceRow[]>`
    WITH candidates AS (
      SELECT DISTINCT ON (p.id)
        p.id,
        p.name,
        p.address,
        p.location,
        GREATEST(
          ts_rank(
            to_tsvector('english', p.name || ' ' || p.address),
            plainto_tsquery('english', ${q})
          ),
          CASE WHEN p.name ILIKE ${'%' + q + '%'} THEN 0.5 ELSE 0 END,
          COALESCE(dish.rank, 0) * 0.8
        ) AS rank
      FROM places p
      LEFT JOIN LATERAL (
        SELECT MAX(ts_rank(
          to_tsvector('english', COALESCE(r.dish_name, '')),
          plainto_tsquery('english', ${q})
        )) AS rank
        FROM reviews r
        WHERE r.place_id = p.id
          AND r.status = 'PUBLISHED'
          AND r.dish_name IS NOT NULL
          AND (
            to_tsvector('english', COALESCE(r.dish_name, '')) @@ plainto_tsquery('english', ${q})
            OR r.dish_name ILIKE ${'%' + q + '%'}
          )
      ) dish ON TRUE
      WHERE to_tsvector('english', p.name || ' ' || p.address) @@ plainto_tsquery('english', ${q})
         OR p.name ILIKE ${'%' + q + '%'}
         OR dish.rank IS NOT NULL
      ORDER BY p.id, rank DESC
    )
    SELECT
      c.id,
      c.name,
      c.address,
      ST_Y(c.location::geometry) AS lat,
      ST_X(c.location::geometry) AS lng,
      rs.avg_rating,
      rs.review_count
    FROM candidates c
    LEFT JOIN LATERAL (
      SELECT
        ROUND(AVG(r.rating_overall)::numeric, 1)::float AS avg_rating,
        COUNT(r.id)::int AS review_count
      FROM reviews r
      WHERE r.place_id = c.id AND r.status = 'PUBLISHED'
    ) rs ON TRUE
    ORDER BY c.rank DESC
    LIMIT ${limit}
  `
}

/** No filters -- returns most-reviewed places. */
export async function searchPopular(
  limit: number,
): Promise<PlaceRow[]> {
  return prisma.$queryRaw<PlaceRow[]>`
    SELECT
      p.id, p.name, p.address,
      ST_Y(p.location::geometry) AS lat,
      ST_X(p.location::geometry) AS lng,
      ROUND(AVG(r.rating_overall)::numeric, 1)::float AS avg_rating,
      COUNT(r.id)::int AS review_count
    FROM places p
    LEFT JOIN reviews r ON r.place_id = p.id AND r.status = 'PUBLISHED'
    GROUP BY p.id, p.name, p.address, p.location
    ORDER BY review_count DESC, avg_rating DESC NULLS LAST
    LIMIT ${limit}
  `
}
