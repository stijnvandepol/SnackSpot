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

/** Nearby search with a required text filter. */
export async function searchNearbyWithText(
  lat: number,
  lng: number,
  radius: number,
  q: string,
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
      AND (
        to_tsvector('english', p.name || ' ' || p.address) @@ plainto_tsquery('english', ${q})
        OR p.name ILIKE ${'%' + q + '%'}
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

/** Nearby search without a text filter. */
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

/** Text-only search ranked by relevance. */
export async function searchByText(
  q: string,
  limit: number,
): Promise<PlaceRow[]> {
  return prisma.$queryRaw<PlaceRow[]>`
    WITH candidates AS (
      SELECT
        p.id,
        p.name,
        p.address,
        p.location,
        ts_rank(
          to_tsvector('english', p.name || ' ' || p.address),
          plainto_tsquery('english', ${q})
        ) AS rank
      FROM places p
      WHERE to_tsvector('english', p.name || ' ' || p.address) @@ plainto_tsquery('english', ${q})
         OR p.name ILIKE ${'%' + q + '%'}
      ORDER BY rank DESC
      LIMIT ${limit}
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
