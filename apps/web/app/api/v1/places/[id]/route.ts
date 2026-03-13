import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, err, serverError, withPublicCache } from '@/lib/api-helpers'
import { buildCacheKey, getCachedJson, setCachedJson } from '@/lib/cache'
import { getClientIP, rateLimitIP } from '@/lib/rate-limit'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const ip = getClientIP(_req)
    const rl = await rateLimitIP(ip, 'place_detail', 180, 60)
    if (!rl.allowed) {
      return Response.json({ error: 'Too many requests - try again later' }, { status: 429 })
    }

    const cacheKey = buildCacheKey('place-detail', id)
    const cached = await getCachedJson<{
      id: string
      name: string
      address: string
      lat: number
      lng: number
      avg_rating: number | null
      review_count: number
      created_at: Date
    }>(cacheKey)
    if (cached) {
      return withPublicCache(ok(cached), 30, 120)
    }

    const [place] = await prisma.$queryRaw<
      Array<{
        id: string
        name: string
        address: string
        lat: number
        lng: number
        avg_rating: number | null
        review_count: number
        created_at: Date
      }>
    >`
      SELECT
        p.id,
        p.name,
        p.address,
        ST_Y(p.location::geometry) AS lat,
        ST_X(p.location::geometry) AS lng,
        ROUND(AVG(r.rating_overall)::numeric, 1)::float AS avg_rating,
        COUNT(r.id)::int AS review_count,
        p.created_at
      FROM places p
      LEFT JOIN reviews r ON r.place_id = p.id AND r.status = 'PUBLISHED'
      WHERE p.id = ${id}
      GROUP BY p.id, p.name, p.address, p.location, p.created_at
    `

    if (!place) return err('Place not found', 404)

    await setCachedJson(cacheKey, place, 30)
    return withPublicCache(ok(place), 30, 120)
  } catch (e) {
    return serverError('places/[id]', e)
  }
}
