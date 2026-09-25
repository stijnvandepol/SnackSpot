import { prisma } from '@/lib/db'
import { getPhotoByPlace } from '@/lib/city-index'

/**
 * "Bewaren": a private list of places someone wants to try or return to.
 *
 * The table has existed since the first migration but nothing wrote to it. It is the
 * cheapest retention loop available: a saved place is a reason to come back, and a visitor
 * who saves something has taken their first step as a user, before they ever write a review.
 */
export const MAX_FAVORITES_PER_USER = 500

export interface FavoritePlace {
  id: string
  name: string
  address: string
  city: string | null
  avgRating: number | null
  reviewCount: number
  photoUrl: string | null
  savedAt: string
}

interface FavoriteRow {
  id: string
  name: string
  address: string
  city: string | null
  avg_rating: number | null
  review_count: number
  saved_at: Date
}

export async function isFavorite(userId: string, placeId: string): Promise<boolean> {
  const row = await prisma.favorite.findUnique({
    where: { userId_placeId: { userId, placeId } },
    select: { placeId: true },
  })
  return row !== null
}

export type SaveResult = { ok: true } | { ok: false; status: 404 | 409; error: string }

export async function saveFavorite(userId: string, placeId: string): Promise<SaveResult> {
  const place = await prisma.place.findUnique({ where: { id: placeId }, select: { id: true } })
  if (!place) return { ok: false, status: 404, error: 'Place not found' }

  const count = await prisma.favorite.count({ where: { userId } })
  if (count >= MAX_FAVORITES_PER_USER) {
    return { ok: false, status: 409, error: `You can save up to ${MAX_FAVORITES_PER_USER} places` }
  }

  // Idempotent: saving twice is not an error, the second tap just confirms.
  await prisma.favorite.upsert({
    where: { userId_placeId: { userId, placeId } },
    create: { userId, placeId },
    update: {},
  })
  return { ok: true }
}

export async function removeFavorite(userId: string, placeId: string): Promise<void> {
  await prisma.favorite.deleteMany({ where: { userId, placeId } })
}

export async function listFavorites(userId: string, limit: number): Promise<FavoritePlace[]> {
  const rows = await prisma.$queryRaw<FavoriteRow[]>`
    SELECT
      p.id,
      p.name,
      p.address,
      NULLIF(TRIM(p.city), '')                         AS city,
      ROUND(AVG(r.rating_overall)::numeric, 1)::float  AS avg_rating,
      COUNT(r.id)::int                                 AS review_count,
      f.created_at                                     AS saved_at
    FROM favorites f
    JOIN places p ON p.id = f.place_id
    LEFT JOIN reviews r ON r.place_id = p.id AND r.status = 'PUBLISHED'
    WHERE f.user_id = ${userId}
    GROUP BY p.id, p.name, p.address, p.city, f.created_at
    ORDER BY f.created_at DESC
    LIMIT ${limit}
  `
  const photos = await getPhotoByPlace(rows.map((row) => row.id))
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    avgRating: row.avg_rating,
    reviewCount: row.review_count,
    photoUrl: photos.get(row.id) ?? null,
    savedAt: row.saved_at.toISOString(),
  }))
}
