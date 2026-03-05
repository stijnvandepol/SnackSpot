import { BadgeCriteriaType } from '@prisma/client'
import { prisma } from '@/lib/db'

interface ActivitySnapshot {
  postsCount: number
  uniqueLocationsCount: number
  activeDaysCount: number
  likesReceivedCount: number
}

async function getActivitySnapshot(userId: string): Promise<ActivitySnapshot> {
  const [postsCount, uniqueLocationsRows, activeDaysRows, likesReceivedRows] = await Promise.all([
    prisma.review.count({ where: { userId, status: 'PUBLISHED' } }),
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT place_id)::int AS count
      FROM reviews
      WHERE user_id = ${userId} AND status = 'PUBLISHED'
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT DATE(created_at))::int AS count
      FROM reviews
      WHERE user_id = ${userId} AND status = 'PUBLISHED'
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(rl.review_id)::int AS count
      FROM review_likes rl
      INNER JOIN reviews r ON r.id = rl.review_id
      WHERE r.user_id = ${userId} AND r.status = 'PUBLISHED'
    `,
  ])

  return {
    postsCount,
    uniqueLocationsCount: uniqueLocationsRows[0]?.count ?? 0,
    activeDaysCount: activeDaysRows[0]?.count ?? 0,
    likesReceivedCount: likesReceivedRows[0]?.count ?? 0,
  }
}

export function progressForCriteria(criteriaType: BadgeCriteriaType, snapshot: ActivitySnapshot): number {
  switch (criteriaType) {
    case 'POSTS_COUNT':
      return snapshot.postsCount
    case 'UNIQUE_LOCATIONS_COUNT':
      return snapshot.uniqueLocationsCount
    case 'ACTIVE_DAYS_COUNT':
      return snapshot.activeDaysCount
    case 'LIKES_RECEIVED_COUNT':
      return snapshot.likesReceivedCount
    default:
      return 0
  }
}

export async function recalculateUserBadges(userId: string): Promise<void> {
  const [snapshot, badges, existingRows] = await Promise.all([
    getActivitySnapshot(userId),
    prisma.badge.findMany({ where: { isActive: true } }),
    prisma.userBadge.findMany({ where: { userId } }),
  ])

  if (badges.length === 0) return

  const existingByBadgeId = new Map(existingRows.map((row) => [row.badgeId, row]))

  await prisma.$transaction(
    badges.map((badge) => {
      const progress = progressForCriteria(badge.criteriaType, snapshot)
      const existing = existingByBadgeId.get(badge.id)
      const earnedAt = progress >= badge.criteriaValue
        ? (existing?.earnedAt ?? new Date())
        : null

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
}
