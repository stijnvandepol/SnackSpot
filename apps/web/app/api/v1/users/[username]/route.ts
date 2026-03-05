import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, err, serverError } from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, avatarKey: true, role: true, createdAt: true },
    })
    if (!user) return err('User not found', 404)

    const [reviewCount, favoritesCount] = await Promise.all([
      prisma.review.count({ where: { userId: user.id, status: ReviewStatus.PUBLISHED } }),
      prisma.favorite.count({ where: { userId: user.id } }),
    ])

    return ok({
      ...user,
      _count: {
        reviews: reviewCount,
        favorites: favoritesCount,
      },
    })
  } catch (e) {
    return serverError('users/[username]', e)
  }
}
