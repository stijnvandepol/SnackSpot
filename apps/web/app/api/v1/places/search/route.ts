import { type NextRequest } from 'next/server'
import { PlaceSearchSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { ok, parseQuery, serverError, isResponse } from '@/lib/api-helpers'
import { Prisma } from '@prisma/client'

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
    // ── Nearby search (with optional text filter) ──────────────────────────
    if (query.lat !== undefined && query.lng !== undefined) {
      let rows: PlaceRow[]

      if (query.q) {
        rows = await prisma.$queryRaw<PlaceRow[]>`
          SELECT
            p.id, p.name, p.address,
            ST_Y(p.location::geometry) AS lat,
            ST_X(p.location::geometry) AS lng,
            ST_Distance(p.location, ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography) AS distance_m,
            ROUND(AVG(r.rating)::numeric, 1)::float AS avg_rating,
            COUNT(r.id)::int AS review_count
          FROM places p
          LEFT JOIN reviews r ON r.place_id = p.id AND r.status = 'PUBLISHED'
          WHERE ST_DWithin(
            p.location,
            ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography,
            ${query.radius}
          )
          AND (
            to_tsvector('english', p.name || ' ' || p.address) @@ plainto_tsquery('english', ${query.q})
            OR p.name ILIKE ${'%' + query.q + '%'}
          )
          GROUP BY p.id, p.name, p.address, p.location
          ORDER BY distance_m
          LIMIT ${query.limit}
        `
      } else {
        rows = await prisma.$queryRaw<PlaceRow[]>`
          SELECT
            p.id, p.name, p.address,
            ST_Y(p.location::geometry) AS lat,
            ST_X(p.location::geometry) AS lng,
            ST_Distance(p.location, ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography) AS distance_m,
            ROUND(AVG(r.rating)::numeric, 1)::float AS avg_rating,
            COUNT(r.id)::int AS review_count
          FROM places p
          LEFT JOIN reviews r ON r.place_id = p.id AND r.status = 'PUBLISHED'
          WHERE ST_DWithin(
            p.location,
            ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography,
            ${query.radius}
          )
          GROUP BY p.id, p.name, p.address, p.location
          ORDER BY distance_m
          LIMIT ${query.limit}
        `
      }

      return ok({ data: rows, pagination: { nextCursor: null, hasMore: false } })
    }

    // ── Text-only search ───────────────────────────────────────────────────
    if (query.q) {
      const places = await prisma.$queryRaw<PlaceRow[]>`
        SELECT
          p.id, p.name, p.address,
          ST_Y(p.location::geometry) AS lat,
          ST_X(p.location::geometry) AS lng,
          ROUND(AVG(r.rating)::numeric, 1)::float AS avg_rating,
          COUNT(r.id)::int AS review_count
        FROM places p
        LEFT JOIN reviews r ON r.place_id = p.id AND r.status = 'PUBLISHED'
        WHERE to_tsvector('english', p.name || ' ' || p.address) @@ plainto_tsquery('english', ${query.q})
           OR p.name ILIKE ${'%' + query.q + '%'}
        GROUP BY p.id, p.name, p.address, p.location
        ORDER BY ts_rank(
          to_tsvector('english', p.name || ' ' || p.address),
          plainto_tsquery('english', ${query.q})
        ) DESC
        LIMIT ${query.limit}
      `
      return ok({ data: places, pagination: { nextCursor: null, hasMore: false } })
    }

    // ── No filters – most-reviewed places ─────────────────────────────────
    const places = await prisma.$queryRaw<PlaceRow[]>`
      SELECT
        p.id, p.name, p.address,
        ST_Y(p.location::geometry) AS lat,
        ST_X(p.location::geometry) AS lng,
        ROUND(AVG(r.rating)::numeric, 1)::float AS avg_rating,
        COUNT(r.id)::int AS review_count
      FROM places p
      LEFT JOIN reviews r ON r.place_id = p.id AND r.status = 'PUBLISHED'
      GROUP BY p.id, p.name, p.address, p.location
      ORDER BY review_count DESC, avg_rating DESC NULLS LAST
      LIMIT ${query.limit}
    `
    return ok({ data: places, pagination: { nextCursor: null, hasMore: false } })
  } catch (e) {
    return serverError('places/search', e)
  }
}
