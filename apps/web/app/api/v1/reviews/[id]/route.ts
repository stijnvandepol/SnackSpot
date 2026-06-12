import { type NextRequest } from 'next/server'
import { UpdateReviewSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import {
  ok,
  err,
  parseBody,
  requireAuth,
  getAuthPayload,
  serverError,
  isResponse,
  withNoStore,
} from '@/lib/api-helpers'
import { restorableUntil } from '@/lib/privacy'
import { ReviewStatus } from '@prisma/client'
import { recalculateUserBadges } from '@/lib/badge-service'
import { reviewListSelect, serializeReview, checkReviewVisibility } from '@/lib/review-helpers'
import { updateReview } from '@/lib/review-service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = getAuthPayload(req)

  try {
    const review = await prisma.review.findUnique({
      where: { id },
      select: {
        // reviewListSelect already selects reviewPhotos (ordered by sortOrder,
        // take: 5, { photo: { id, variants } }) — don't re-declare it, which
        // previously dropped the take cap and selected an unused sortOrder.
        ...reviewListSelect(auth?.sub),
        updatedAt: true,
        deletedAt: true,
        deletedById: true,
      },
    })

    if (!review) return err('Review not found', 404)

    const visibilityError = checkReviewVisibility(
      { status: review.status as ReviewStatus, userId: review.user.id },
      auth,
    )
    if (visibilityError) return visibilityError

    return withNoStore(ok(serializeReview(review)))
  } catch (e) {
    return serverError('reviews/[id] GET', e)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const body = await parseBody(req, UpdateReviewSchema)
  if (isResponse(body)) return body

  try {
    const result = await updateReview({ userId: auth.sub, reviewId: id, input: body })
    if (!result.ok) return err(result.error, result.status)
    return ok(result.value)
  } catch (e) {
    return serverError('reviews/[id] PATCH', e)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  try {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { userId: true, status: true },
    })
    if (!review || review.status === ReviewStatus.DELETED) return err('Review not found', 404)

    // Owner or admin/mod may soft-delete
    const isOwner = review.userId === auth.sub
    const isMod = auth.role === 'MODERATOR' || auth.role === 'ADMIN'
    if (!isOwner && !isMod) return err('Forbidden', 403)

    // Soft delete with a restore window: deletedAt drives the worker's purge
    // job (hard delete after 30 days, GDPR Art. 17) and deletedById records
    // who deleted it - only self-deleted reviews are restorable by the owner.
    const deletedAt = new Date()
    await prisma.review.update({
      where: { id },
      data: { status: ReviewStatus.DELETED, deletedAt, deletedById: auth.sub },
    })
    await recalculateUserBadges(review.userId)
    return ok({
      message: 'Review deleted',
      restorableUntil: isOwner ? restorableUntil(deletedAt).toISOString() : null,
    })
  } catch (e) {
    return serverError('reviews/[id] DELETE', e)
  }
}
