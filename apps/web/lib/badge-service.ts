import { BadgeCriteriaType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { notifyBadgeEarned } from '@/lib/notification-service'

const ACTIVITY_WINDOW_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

interface ActivitySnapshot {
  postsCount: number
  postsLast30Days: number
  uniqueLocationsCount: number
  activeDaysCount: number
  bestStreakDays: number
  likesReceivedCount: number
  commentsReceivedCount: number
}

interface RecalculateOptions {
  criteriaTypes?: BadgeCriteriaType[]
}

async function getActivitySnapshot(userId: string): Promise<ActivitySnapshot> {
  type SnapshotRow = {
    posts_count: number
    posts_last_30: number
    unique_locations: number
    active_days: Date[] | null
    likes_received: number
    comments_received: number
  }

  const windowStart = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * MS_PER_DAY)

  const [row] = await prisma.$queryRaw<SnapshotRow[]>`
    WITH pr AS (
      SELECT id, place_id, created_at
      FROM reviews
      WHERE user_id = ${userId} AND status = 'PUBLISHED'
    )
    SELECT
      (SELECT COUNT(*)::int FROM pr)                                                  AS posts_count,
      (SELECT COUNT(*)::int FROM pr WHERE created_at >= ${windowStart})               AS posts_last_30,
      (SELECT COUNT(DISTINCT place_id)::int FROM pr)                                  AS unique_locations,
      (SELECT ARRAY_AGG(DISTINCT DATE(created_at) ORDER BY DATE(created_at)) FROM pr) AS active_days,
      (SELECT COUNT(rl.review_id)::int FROM review_likes rl
       INNER JOIN pr ON pr.id = rl.review_id)                                         AS likes_received,
      (SELECT COUNT(c.id)::int FROM comments c
       INNER JOIN pr ON pr.id = c.review_id)                                          AS comments_received
  `

  const activeDays = (row?.active_days ?? [])
    .map((d) => new Date(d))
    .map((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())))
    .sort((a, b) => a.getTime() - b.getTime())

  const bestStreakDays = (() => {
    if (activeDays.length === 0) return 0
    let best = 1
    let running = 1
    for (let i = 1; i < activeDays.length; i++) {
      const diffDays = Math.round((activeDays[i].getTime() - activeDays[i - 1].getTime()) / MS_PER_DAY)
      if (diffDays === 1) {
        running += 1
        best = Math.max(best, running)
      } else {
        running = 1
      }
    }
    return best
  })()

  return {
    postsCount: row?.posts_count ?? 0,
    postsLast30Days: row?.posts_last_30 ?? 0,
    uniqueLocationsCount: row?.unique_locations ?? 0,
    activeDaysCount: activeDays.length,
    bestStreakDays,
    likesReceivedCount: row?.likes_received ?? 0,
    commentsReceivedCount: row?.comments_received ?? 0,
  }
}

export function progressForCriteria(criteriaType: BadgeCriteriaType, snapshot: ActivitySnapshot): number {
  switch (criteriaType) {
    case 'POSTS_COUNT':
      return snapshot.postsCount
    case 'POSTS_LAST_30_DAYS':
      return snapshot.postsLast30Days
    case 'UNIQUE_LOCATIONS_COUNT':
      return snapshot.uniqueLocationsCount
    case 'ACTIVE_DAYS_COUNT':
      return snapshot.activeDaysCount
    case 'BEST_STREAK_DAYS':
      return snapshot.bestStreakDays
    case 'LIKES_RECEIVED_COUNT':
      return snapshot.likesReceivedCount
    case 'COMMENTS_RECEIVED_COUNT':
      return snapshot.commentsReceivedCount
    default:
      return 0
  }
}

export async function recalculateUserBadges(userId: string, options?: RecalculateOptions): Promise<void> {
  const criteriaFilter = options?.criteriaTypes?.length
    ? { in: options.criteriaTypes }
    : undefined

  const [snapshot, badges, existingRows] = await Promise.all([
    getActivitySnapshot(userId),
    prisma.badge.findMany({ where: { isActive: true, ...(criteriaFilter ? { criteriaType: criteriaFilter } : {}) } }),
    prisma.userBadge.findMany({
      where: {
        userId,
        ...(criteriaFilter ? { badge: { criteriaType: criteriaFilter } } : {}),
      },
    }),
  ])

  if (badges.length === 0) return

  const existingByBadgeId = new Map<string, { earnedAt: Date | null }>(
    existingRows.map((row) => [row.badgeId, { earnedAt: row.earnedAt }]),
  )

  // Pre-compute each badge's current progress once — used in both the
  // newly-earned filter and the upsert below.
  const progressByBadgeId = new Map(
    badges.map((badge) => [badge.id, progressForCriteria(badge.criteriaType, snapshot)]),
  )

  const newlyEarnedBadges = badges.filter((badge) => {
    const progress = progressByBadgeId.get(badge.id)!
    const existing = existingByBadgeId.get(badge.id)
    return progress >= badge.criteriaValue && !existing?.earnedAt
  })

  await prisma.$transaction(
    badges.map((badge) => {
      const progress = progressByBadgeId.get(badge.id)!
      const existing = existingByBadgeId.get(badge.id)
      const earnedAt = progress >= badge.criteriaValue
        ? (existing?.earnedAt ?? new Date())
        : (existing?.earnedAt ?? null)

      return prisma.userBadge.upsert({
        where: { userId_badgeId: { userId, badgeId: badge.id } },
        create: {
          userId,
          badgeId: badge.id,
          progressCurrent: progress,
          progressTarget: badge.criteriaValue,
          earnedAt,
        },
        update: {
          progressCurrent: progress,
          progressTarget: badge.criteriaValue,
          earnedAt: {
            set: earnedAt,
          },
        },
      })
    }),
  )

  await Promise.allSettled(
    newlyEarnedBadges.map((badge) => notifyBadgeEarned(userId, badge.name)),
  )
}
