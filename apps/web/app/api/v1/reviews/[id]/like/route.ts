import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, err, requireAuth, getAuthPayload, serverError, isResponse } from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'
import { recalculateUserBadges } from '@/lib/badge-service'
import { notifyReviewLike } from '@/lib/notification-service'

async function getLikeState(reviewId: string, userId?: string) {
  const [likeCount, likedByMe] = await Promise.all([
    prisma.reviewLike.count({ where: { reviewId } }),
    userId
      ? prisma.reviewLike.findUnique({
          where: { userId_reviewId: { userId, reviewId } },
          select: { userId: true },
        }).then((row: { userId: string } | null) => Boolean(row))
      : Promise.resolve(false),
  ])

  return { likeCount, likedByMe }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { id: true, status: true, userId: true },
    })
    if (!review || review.status === ReviewStatus.DELETED) return err('Review not found', 404)

    const auth = getAuthPayload(req)
    const state = await getLikeState(id, auth?.sub)
    return ok(state)
  } catch (e) {
    return serverError('reviews/[id]/like GET', e)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const { id } = await params

  try {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { id: true, status: true, userId: true },
    })
    if (!review || review.status !== ReviewStatus.PUBLISHED) return err('Review not found', 404)

    await prisma.reviewLike.createMany({
      data: [{ userId: auth.sub, reviewId: id }],
      skipDuplicates: true,
    })

    // Notify review owner about the like
    await notifyReviewLike(id, auth.sub)

    await recalculateUserBadges(review.userId, { criteriaTypes: ['LIKES_RECEIVED_COUNT'] })

    const state = await getLikeState(id, auth.sub)
    return ok(state)
  } catch (e) {
    return serverError('reviews/[id]/like POST', e)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const { id } = await params

  try {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { userId: true },
    })
    if (!review) return err('Review not found', 404)

    await prisma.reviewLike.deleteMany({
      where: { userId: auth.sub, reviewId: id },
    })

    await recalculateUserBadges(review.userId, { criteriaTypes: ['LIKES_RECEIVED_COUNT'] })

    const state = await getLikeState(id, auth.sub)
    return ok(state)
  } catch (e) {
    return serverError('reviews/[id]/like DELETE', e)
  }
}
