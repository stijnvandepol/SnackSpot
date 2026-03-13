import { type NextRequest } from 'next/server'
import { PlaceSearchSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { ok, parseQuery, serverError, isResponse, withPublicCache } from '@/lib/api-helpers'
import { Prisma } from '@prisma/client'
import { buildCacheKey, getCachedJson, setCachedJson, stableSearchParams } from '@/lib/cache'
import { getClientIP, rateLimitIP } from '@/lib/rate-limit'

type PlaceRow = {
  id: string; name: string; address: string
  lat: number; lng: number
  distance_m?: number
  avg_rating: number | null
  review_count: number
}

export async function GET(req: NextRequest) {
  const query = parseQuery(req, PlaceSearchSchema)
  if (isResponse(query)) return query

  try {
    const ip = getClientIP(req)
    const rl = await rateLimitIP(ip, 'places_search', 120, 60)
    if (!rl.allowed) {
      return Response.json({ error: 'Too many search requests - try again later' }, { status: 429 })
    }

    const cacheKey = buildCacheKey('places-search', stableSearchParams(req.nextUrl.searchParams))
    const cached = await getCachedJson<{ data: PlaceRow[]; pagination: { nextCursor: null; hasMore: false } }>(cacheKey)
    if (cached) {
      return withPublicCache(ok(cached), 15, 60)
    }

    let payload: { data: PlaceRow[]; pagination: { nextCursor: null; hasMore: false } }

    // ── Nearby search (with optional text filter) ──────────────────────────
    if (query.lat !== undefined && query.lng !== undefined) {
      let rows: PlaceRow[]

      if (query.q) {
        rows = await prisma.$queryRaw<PlaceRow[]>`
          WITH candidates AS (
            SELECT
              p.id,
              p.name,
              p.address,
              p.location,
              ST_Distance(p.location, ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography) AS distance_m
            FROM places p
            WHERE ST_DWithin(
              p.location,
              ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography,
              ${query.radius}
            )
            AND (
              to_tsvector('english', p.name || ' ' || p.address) @@ plainto_tsquery('english', ${query.q})
              OR p.name ILIKE ${'%' + query.q + '%'}
            )
            ORDER BY distance_m
            LIMIT ${query.limit}
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
      } else {
        rows = await prisma.$queryRaw<PlaceRow[]>`
          WITH candidates AS (
            SELECT
              p.id,
              p.name,
              p.address,
              p.location,
              ST_Distance(p.location, ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography) AS distance_m
            FROM places p
            WHERE ST_DWithin(
              p.location,
              ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography,
              ${query.radius}
            )
            ORDER BY distance_m
            LIMIT ${query.limit}
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

      payload = { data: rows, pagination: { nextCursor: null, hasMore: false } }
      await setCachedJson(cacheKey, payload, 15)
      return withPublicCache(ok(payload), 15, 60)
    }

    // ── Text-only search ───────────────────────────────────────────────────
    if (query.q) {
      const places = await prisma.$queryRaw<PlaceRow[]>`
        WITH candidates AS (
          SELECT
            p.id,
            p.name,
            p.address,
            p.location,
            ts_rank(
              to_tsvector('english', p.name || ' ' || p.address),
              plainto_tsquery('english', ${query.q})
            ) AS rank
          FROM places p
          WHERE to_tsvector('english', p.name || ' ' || p.address) @@ plainto_tsquery('english', ${query.q})
             OR p.name ILIKE ${'%' + query.q + '%'}
          ORDER BY rank DESC
          LIMIT ${query.limit}
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
      payload = { data: places, pagination: { nextCursor: null, hasMore: false } }
      await setCachedJson(cacheKey, payload, 30)
      return withPublicCache(ok(payload), 30, 120)
    }

    // ── No filters – most-reviewed places ─────────────────────────────────
    const places = await prisma.$queryRaw<PlaceRow[]>`
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
      LIMIT ${query.limit}
    `
    payload = { data: places, pagination: { nextCursor: null, hasMore: false } }
    await setCachedJson(cacheKey, payload, 30)
    return withPublicCache(ok(payload), 30, 120)
  } catch (e) {
    return serverError('places/search', e)
  }
}
