import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, err, serverError, withPublicCache } from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params

  try {
    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { id: true, username: true, bio: true, avatarKey: true, role: true, isVerified: true, createdAt: true },
    })
    if (!user) return err('User not found', 404)

    const [reviewCount, favoritesCount, likesReceivedCount] = await Promise.all([
      prisma.review.count({ where: { userId: user.id, status: ReviewStatus.PUBLISHED } }),
      prisma.favorite.count({ where: { userId: user.id } }),
      prisma.reviewLike.count({
        where: {
          review: {
            userId: user.id,
            status: ReviewStatus.PUBLISHED,
          },
        },
      }),
    ])

    return await withPublicCache(ok({
      ...user,
      _count: {
        reviews: reviewCount,
        favorites: favoritesCount,
      },
      totalLikesReceived: likesReceivedCount,
    }), 30, 120)
  } catch (e) {
    return serverError('users/[username]', e)
  }
}
