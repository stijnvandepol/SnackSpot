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
  const [postsCount, postsLast30Days, uniqueLocationsRows, activeDaysRows, likesReceivedRows, commentsReceivedRows] = await Promise.all([
    prisma.review.count({ where: { userId, status: 'PUBLISHED' } }),
    prisma.review.count({
      where: {
        userId,
        status: 'PUBLISHED',
        createdAt: { gte: new Date(Date.now() - ACTIVITY_WINDOW_DAYS * MS_PER_DAY) },
      },
    }),
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT place_id)::int AS count
      FROM reviews
      WHERE user_id = ${userId} AND status = 'PUBLISHED'
    `,
    prisma.$queryRaw<Array<{ day: Date }>>`
      SELECT DISTINCT DATE(created_at) AS day
      FROM reviews
      WHERE user_id = ${userId} AND status = 'PUBLISHED'
      ORDER BY day ASC
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
  ])

  const bestStreakDays = (() => {
    const sorted = activeDaysRows
      .map((row) => new Date(row.day))
      .map((date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())))
      .sort((a, b) => a.getTime() - b.getTime())

    if (sorted.length === 0) return 0

    let best = 1
    let running = 1
    for (let i = 1; i < sorted.length; i++) {
      const diffDays = Math.round((sorted[i].getTime() - sorted[i - 1].getTime()) / MS_PER_DAY)
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
    postsCount,
    postsLast30Days,
    uniqueLocationsCount: uniqueLocationsRows[0]?.count ?? 0,
    activeDaysCount: activeDaysRows.length,
    bestStreakDays,
    likesReceivedCount: likesReceivedRows[0]?.count ?? 0,
    commentsReceivedCount: commentsReceivedRows[0]?.count ?? 0,
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

  const newlyEarnedBadges = badges.filter((badge) => {
    const progress = progressForCriteria(badge.criteriaType, snapshot)
    const existing = existingByBadgeId.get(badge.id)
    return progress >= badge.criteriaValue && !existing?.earnedAt
  })

  await prisma.$transaction(
    badges.map((badge) => {
      const progress = progressForCriteria(badge.criteriaType, snapshot)
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
