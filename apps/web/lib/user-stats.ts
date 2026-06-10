import { prisma } from '@/lib/db'
import { xpProgress, type XpProgress } from '@/lib/xp-service'
import { computeStreaks, toDateKey } from '@/lib/streaks'

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
  bitesCount: number
  xp: XpProgress
}

/** Days with at least one published review (UTC day) or one bite (local day). */
async function getActiveDayKeys(userId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ day: Date }>>`
    SELECT DISTINCT day FROM (
      SELECT DATE(created_at) AS day
      FROM reviews
      WHERE user_id = ${userId} AND status = 'PUBLISHED'
      UNION
      SELECT local_date AS day
      FROM bites
      WHERE user_id = ${userId}
    ) d
    ORDER BY day ASC
  `
  return rows.map((row) => toDateKey(new Date(row.day)))
}

export interface ProgressSnapshot {
  streak: { current: number; best: number }
  xp: XpProgress
  bitesCount: number
}

/** Lightweight streak + XP snapshot for write-path responses (bite/review create). */
export async function getProgressSnapshot(userId: string): Promise<ProgressSnapshot> {
  const [days, stats] = await Promise.all([
    getActiveDayKeys(userId),
    prisma.userStats.findUnique({ where: { userId } }),
  ])
  return {
    streak: computeStreaks(days),
    xp: xpProgress(stats?.xpTotal ?? 0),
    bitesCount: stats?.bitesCount ?? 0,
  }
}

export async function getUserStats(userId: string): Promise<UserStatsData> {
  const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // The six scalar aggregates all run over the same filtered set
  // (reviews for this user with status PUBLISHED), so they are computed in a
  // single CTE-based query instead of six separate round-trips. This mirrors
  // the pattern already used by badge-service.getActivitySnapshot. The
  // set-returning stats (weekly buckets, active days, top locations) remain
  // separate queries.
  const [scalarRows, weeklyRows, activeDayKeys, topLocationsRows, userStatsRow] = await Promise.all([
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
    getActiveDayKeys(userId),
    prisma.$queryRaw<Array<{ place_id: string; place_name: string; count: number }>>`
      SELECT r.place_id, p.name AS place_name, COUNT(r.id)::int AS count
      FROM reviews r
      INNER JOIN places p ON p.id = r.place_id
      WHERE r.user_id = ${userId} AND r.status = 'PUBLISHED'
      GROUP BY r.place_id, p.name
      ORDER BY count DESC, place_name ASC
      LIMIT 3
    `,
    prisma.userStats.findUnique({ where: { userId } }),
  ])

  const scalar = scalarRows[0]
  const streak = computeStreaks(activeDayKeys)

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
    bitesCount: userStatsRow?.bitesCount ?? 0,
    xp: xpProgress(userStatsRow?.xpTotal ?? 0),
  }
}
