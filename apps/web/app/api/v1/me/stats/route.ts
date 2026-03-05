import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, requireAuth, serverError, isResponse, withNoStore } from '@/lib/api-helpers'

function toDateKey(value: Date): string {
  const y = value.getUTCFullYear()
  const m = String(value.getUTCMonth() + 1).padStart(2, '0')
  const d = String(value.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function computeStreaks(dateKeys: string[]): { current: number; best: number } {
  if (dateKeys.length === 0) return { current: 0, best: 0 }

  const sorted = [...dateKeys].sort()
  let best = 1
  let running = 1

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00.000Z`)
    const curr = new Date(`${sorted[i]}T00:00:00.000Z`)
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000))
    if (diffDays === 1) {
      running += 1
      best = Math.max(best, running)
    } else {
      running = 1
    }
  }

  const uniqueSet = new Set(sorted)
  const today = new Date()
  let cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  let current = 0
  while (uniqueSet.has(toDateKey(cursor))) {
    current += 1
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000)
  }

  return { current, best }
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  try {
    const [
      totalPosts,
      uniqueLocationsRows,
      avgOverallRows,
      likesRows,
      weeklyRows,
      activeDaysRows,
      topLocationsRows,
    ] = await Promise.all([
      prisma.review.count({ where: { userId: auth.sub, status: 'PUBLISHED' } }),
      prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(DISTINCT place_id)::int AS count
        FROM reviews
        WHERE user_id = ${auth.sub} AND status = 'PUBLISHED'
      `,
      prisma.$queryRaw<Array<{ avg: number | null }>>`
        SELECT ROUND(AVG(rating_overall)::numeric, 1)::float AS avg
        FROM reviews
        WHERE user_id = ${auth.sub} AND status = 'PUBLISHED'
      `,
      prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(rl.review_id)::int AS count
        FROM review_likes rl
        INNER JOIN reviews r ON r.id = rl.review_id
        WHERE r.user_id = ${auth.sub} AND r.status = 'PUBLISHED'
      `,
      prisma.$queryRaw<Array<{ week: Date; posts: number }>>`
        SELECT DATE_TRUNC('week', created_at)::date AS week, COUNT(*)::int AS posts
        FROM reviews
        WHERE user_id = ${auth.sub}
          AND status = 'PUBLISHED'
          AND created_at >= NOW() - INTERVAL '8 weeks'
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY week ASC
      `,
      prisma.$queryRaw<Array<{ day: Date }>>`
        SELECT DISTINCT DATE(created_at) AS day
        FROM reviews
        WHERE user_id = ${auth.sub} AND status = 'PUBLISHED'
        ORDER BY day ASC
      `,
      prisma.$queryRaw<Array<{ place_id: string; place_name: string; count: number }>>`
        SELECT r.place_id, p.name AS place_name, COUNT(r.id)::int AS count
        FROM reviews r
        INNER JOIN places p ON p.id = r.place_id
        WHERE r.user_id = ${auth.sub} AND r.status = 'PUBLISHED'
        GROUP BY r.place_id, p.name
        ORDER BY count DESC, place_name ASC
        LIMIT 3
      `,
    ])

    const days = activeDaysRows.map((row: (typeof activeDaysRows)[number]) => toDateKey(new Date(row.day)))
    const streak = computeStreaks(days)

    return withNoStore(ok({
      totalPosts,
      totalLikesReceived: likesRows[0]?.count ?? 0,
      totalCommentsReceived: null,
      uniqueLocationsVisited: uniqueLocationsRows[0]?.count ?? 0,
      averageOverallRatingGiven: avgOverallRows[0]?.avg ?? null,
      topLocations: topLocationsRows.map((row: (typeof topLocationsRows)[number]) => ({
        id: row.place_id,
        name: row.place_name,
        posts: row.count,
      })),
      weeklyActivity: weeklyRows.map((row: (typeof weeklyRows)[number]) => ({
        weekStart: new Date(row.week).toISOString(),
        posts: row.posts,
      })),
      streak,
    }))
  } catch (e) {
    return serverError('me/stats GET', e)
  }
}
