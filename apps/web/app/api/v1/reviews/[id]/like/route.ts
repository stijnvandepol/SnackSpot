import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, err, requireAuth, getAuthPayload, serverError, isResponse } from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'
import { recalculateUserBadges } from '@/lib/badge-service'
import { notifyReviewLike } from '@/lib/notification-service'
import { awardXp } from '@/lib/xp-service'
import { bumpQuestProgress } from '@/lib/quest-service'

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

    const likeResult = await prisma.reviewLike.createMany({
      data: [{ userId: auth.sub, reviewId: id }],
      skipDuplicates: true,
    })

    // Quest progress only for genuinely new likes (re-likes are skipped above).
    if (likeResult.count > 0) {
      await bumpQuestProgress(auth.sub, 'LIKES_GIVEN')
    }

    // Owner notification, badge recalculation, XP and the response state are
    // independent of each other — run them in parallel. The XP ref includes
    // the liker, so like/unlike cycles can never award twice.
    const [state] = await Promise.all([
      getLikeState(id, auth.sub),
      notifyReviewLike(id, auth.sub),
      recalculateUserBadges(review.userId, { criteriaTypes: ['LIKES_RECEIVED_COUNT'] }),
      ...(review.userId !== auth.sub
        ? [awardXp({ userId: review.userId, reason: 'LIKE_RECEIVED', refType: 'like', refId: `${id}:${auth.sub}` })]
        : []),
    ])
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

    const [state] = await Promise.all([
      getLikeState(id, auth.sub),
      recalculateUserBadges(review.userId, { criteriaTypes: ['LIKES_RECEIVED_COUNT'] }),
    ])
    return ok(state)
  } catch (e) {
    return serverError('reviews/[id]/like DELETE', e)
  }
}
