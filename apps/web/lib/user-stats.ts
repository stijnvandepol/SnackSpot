import { prisma } from '@/lib/db'
import { ReviewStatus } from '@prisma/client'

export interface UserStatsData {
  totalPosts: number
  postsLast30Days: number
  totalLikesReceived: number
  totalCommentsReceived: number
  uniqueLocationsVisited: number
  averageOverallRatingGiven: number | null
  topLocations: Array<{ id: string; name: string; posts: number }>
  weeklyActivity: Array<{ weekStart: string; posts: number }>
  streak: { current: number; best: number }
}

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

export async function getUserStats(userId: string): Promise<UserStatsData> {
  const [
    totalPosts,
    postsLast30Days,
    uniqueLocationsRows,
    avgOverallRows,
    likesRows,
    commentsRows,
    weeklyRows,
    activeDaysRows,
    topLocationsRows,
  ] = await Promise.all([
    prisma.review.count({ where: { userId, status: ReviewStatus.PUBLISHED } }),
    prisma.review.count({
      where: {
        userId,
        status: ReviewStatus.PUBLISHED,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT place_id)::int AS count
      FROM reviews
      WHERE user_id = ${userId} AND status = 'PUBLISHED'
    `,
    prisma.$queryRaw<Array<{ avg: number | null }>>`
      SELECT ROUND(AVG(rating_overall)::numeric, 1)::float AS avg
      FROM reviews
      WHERE user_id = ${userId} AND status = 'PUBLISHED'
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(rl.review_id)::int AS count
      FROM review_likes rl
      INNER JOIN reviews r ON r.id = rl.review_id
      WHERE r.user_id = ${userId} AND r.status = 'PUBLISHED'
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(c.id)::int AS count
      FROM comments c
      INNER JOIN reviews r ON r.id = c.review_id
      WHERE r.user_id = ${userId} AND r.status = 'PUBLISHED'
    `,
    prisma.$queryRaw<Array<{ week: Date; posts: number }>>`
      SELECT DATE_TRUNC('week', created_at)::date AS week, COUNT(*)::int AS posts
      FROM reviews
      WHERE user_id = ${userId}
        AND status = 'PUBLISHED'
        AND created_at >= NOW() - INTERVAL '8 weeks'
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY week ASC
    `,
    prisma.$queryRaw<Array<{ day: Date }>>`
      SELECT DISTINCT DATE(created_at) AS day
      FROM reviews
      WHERE user_id = ${userId} AND status = 'PUBLISHED'
      ORDER BY day ASC
    `,
    prisma.$queryRaw<Array<{ place_id: string; place_name: string; count: number }>>`
      SELECT r.place_id, p.name AS place_name, COUNT(r.id)::int AS count
      FROM reviews r
      INNER JOIN places p ON p.id = r.place_id
      WHERE r.user_id = ${userId} AND r.status = 'PUBLISHED'
      GROUP BY r.place_id, p.name
      ORDER BY count DESC, place_name ASC
      LIMIT 3
    `,
  ])

  const days = activeDaysRows.map((row) => toDateKey(new Date(row.day)))
  const streak = computeStreaks(days)

  return {
    totalPosts,
    postsLast30Days,
    totalLikesReceived: likesRows[0]?.count ?? 0,
    totalCommentsReceived: commentsRows[0]?.count ?? 0,
    uniqueLocationsVisited: uniqueLocationsRows[0]?.count ?? 0,
    averageOverallRatingGiven: avgOverallRows[0]?.avg ?? null,
    topLocations: topLocationsRows.map((row) => ({
      id: row.place_id,
      name: row.place_name,
      posts: row.count,
    })),
    weeklyActivity: weeklyRows.map((row) => ({
      weekStart: new Date(row.week).toISOString(),
      posts: row.posts,
    })),
    streak,
  }
}
