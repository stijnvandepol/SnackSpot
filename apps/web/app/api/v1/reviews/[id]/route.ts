import { type NextRequest } from 'next/server'
import { UpdateReviewSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import {
  ok,
  noContent,
  err,
  parseBody,
  requireAuth,
  getAuthPayload,
  serverError,
  isResponse,
} from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'
import { normalizeRatings } from '@/lib/ratings'
import { recalculateUserBadges } from '@/lib/badge-service'

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
        id: true,
        rating: true,
        ratingTaste: true,
        ratingValue: true,
        ratingPortion: true,
        ratingService: true,
        ratingOverall: true,
        text: true,
        dishName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { reviewLikes: true } },
        user: { select: { id: true, username: true, avatarKey: true, role: true } },
        place: { select: { id: true, name: true, address: true } },
        reviewLikes: {
          where: auth ? { userId: auth.sub } : { userId: '__no_user__' },
          select: { userId: true },
          take: 1,
        },
        reviewPhotos: {
          orderBy: { sortOrder: 'asc' },
          select: { sortOrder: true, photo: { select: { id: true, variants: true } } },
        },
      },
    })

    if (!review) return err('Review not found', 404)
    if (review.status === ReviewStatus.DELETED) return err('Review not found', 404)
    if (review.status === ReviewStatus.HIDDEN) {
      const isOwner = auth?.sub === review.user.id
      const isMod = auth?.role === 'MODERATOR' || auth?.role === 'ADMIN'
      if (!isOwner && !isMod) return err('Review not found', 404)
    }

    return ok({
      ...review,
      likeCount: review._count.reviewLikes,
      likedByMe: auth ? review.reviewLikes.length > 0 : false,
      ratings: {
        taste: review.ratingTaste,
        value: review.ratingValue,
        portion: review.ratingPortion,
        service: review.ratingService,
      },
      overallRating: Number(review.ratingOverall),
      _count: undefined,
      reviewLikes: undefined,
    })
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
    const review = await prisma.review.findUnique({
      where: { id },
      select: { userId: true, status: true },
    })
    if (!review || review.status === ReviewStatus.DELETED) return err('Review not found', 404)

    // Only the owner can edit
    if (review.userId !== auth.sub) return err('Forbidden', 403)

    const updated = await prisma.review.update({
      where: { id },
      data: {
        ...(body.ratings
          ? {
              rating: Math.round(normalizeRatings(body.ratings).overall),
              ratingTaste: normalizeRatings(body.ratings).taste,
              ratingValue: normalizeRatings(body.ratings).value,
              ratingPortion: normalizeRatings(body.ratings).portion,
              ratingService: normalizeRatings(body.ratings).service,
              ratingOverall: normalizeRatings(body.ratings).overall,
            }
          : body.rating !== undefined
            ? {
                rating: body.rating,
                ratingTaste: body.rating,
                ratingValue: body.rating,
                ratingPortion: body.rating,
                ratingService: null,
                ratingOverall: body.rating,
              }
            : {}),
        ...(body.text !== undefined && { text: body.text }),
        ...(body.dishName !== undefined && { dishName: body.dishName }),
      },
      select: {
        id: true,
        rating: true,
        ratingTaste: true,
        ratingValue: true,
        ratingPortion: true,
        ratingService: true,
        ratingOverall: true,
        text: true,
        dishName: true,
        updatedAt: true,
      },
    })
    return ok({
      ...updated,
      ratings: {
        taste: updated.ratingTaste,
        value: updated.ratingValue,
        portion: updated.ratingPortion,
        service: updated.ratingService,
      },
      overallRating: Number(updated.ratingOverall),
    })
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

    await prisma.review.update({
      where: { id },
      data: { status: ReviewStatus.DELETED },
    })
    await recalculateUserBadges(review.userId)
    return noContent()
  } catch (e) {
    return serverError('reviews/[id] DELETE', e)
  }
}
