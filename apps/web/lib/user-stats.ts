import { prisma } from '@/lib/db'

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
  const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // The six scalar aggregates all run over the same filtered set
  // (reviews for this user with status PUBLISHED), so they are computed in a
  // single CTE-based query instead of six separate round-trips. This mirrors
  // the pattern already used by badge-service.getActivitySnapshot. The
  // set-returning stats (weekly buckets, active days, top locations) remain
  // separate queries.
  const [scalarRows, weeklyRows, activeDaysRows, topLocationsRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        total_posts: number
        posts_last_30: number
        unique_locations: number
        avg_overall: number | null
        likes_received: number
        comments_received: number
      }>
    >`
      WITH pr AS (
        SELECT id, place_id, rating_overall, created_at
        FROM reviews
        WHERE user_id = ${userId} AND status = 'PUBLISHED'
      )
      SELECT
        (SELECT COUNT(*)::int FROM pr)                                   AS total_posts,
        (SELECT COUNT(*)::int FROM pr WHERE created_at >= ${windowStart}) AS posts_last_30,
        (SELECT COUNT(DISTINCT place_id)::int FROM pr)                   AS unique_locations,
        (SELECT ROUND(AVG(rating_overall)::numeric, 1)::float FROM pr)   AS avg_overall,
        (SELECT COUNT(rl.review_id)::int FROM review_likes rl
         INNER JOIN pr ON pr.id = rl.review_id)                         AS likes_received,
        (SELECT COUNT(c.id)::int FROM comments c
         INNER JOIN pr ON pr.id = c.review_id)                          AS comments_received
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

  const scalar = scalarRows[0]
  const days = activeDaysRows.map((row) => toDateKey(new Date(row.day)))
  const streak = computeStreaks(days)

  return {
    totalPosts: scalar?.total_posts ?? 0,
    postsLast30Days: scalar?.posts_last_30 ?? 0,
    totalLikesReceived: scalar?.likes_received ?? 0,
    totalCommentsReceived: scalar?.comments_received ?? 0,
    uniqueLocationsVisited: scalar?.unique_locations ?? 0,
    averageOverallRatingGiven: scalar?.avg_overall ?? null,
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
