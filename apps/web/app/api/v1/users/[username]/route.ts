import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, err, serverError, withPublicCache } from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'
import { getUserStats } from '@/lib/user-stats'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params

  try {
    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { id: true, username: true, bio: true, avatarKey: true, role: true, createdAt: true },
    })
    if (!user) return err('User not found', 404)

    const [reviewCount, favoritesCount, stats] = await Promise.all([
      prisma.review.count({ where: { userId: user.id, status: ReviewStatus.PUBLISHED } }),
      prisma.favorite.count({ where: { userId: user.id } }),
      getUserStats(user.id),
    ])

    const [achievementsCount, recentAchievements] = await Promise.all([
      prisma.userBadge.count({
        where: { userId: user.id, earnedAt: { not: null }, badge: { isActive: true } },
      }),
      prisma.userBadge.findMany({
        where: { userId: user.id, earnedAt: { not: null }, badge: { isActive: true } },
        orderBy: [{ earnedAt: 'desc' }, { createdAt: 'asc' }],
        take: 4,
        select: {
          earnedAt: true,
          badge: {
            select: {
              id: true,
              slug: true,
              name: true,
              description: true,
              tier: true,
            },
          },
        },
      }),
    ])

    return withPublicCache(ok({
      ...user,
      _count: {
        reviews: reviewCount,
        favorites: favoritesCount,
      },
      stats,
      achievements: {
        totalEarned: achievementsCount,
        recent: recentAchievements,
      },
    }), 30, 120)
  } catch (e) {
    return serverError('users/[username]', e)
  }
}
