import { type NextRequest } from 'next/server'
import { UpdateReviewSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import {
  ok,
  noContent,
  err,
  parseBody,
  requireAuth,
  getAuthPayload,
  serverError,
  isResponse,
  withNoStore,
} from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'
import { normalizeRatings } from '@/lib/ratings'
import { recalculateUserBadges } from '@/lib/badge-service'
import { normalizeDishName } from '@/lib/text'

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
        tags: {
          orderBy: { tag: 'asc' },
          select: { tag: true },
        },
        _count: { select: { reviewLikes: true, comments: true } },
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

    return withNoStore(ok({
      ...review,
      rating: Number(review.rating),
      likeCount: review._count.reviewLikes,
      commentCount: review._count.comments,
      likedByMe: auth ? review.reviewLikes.length > 0 : false,
      ratings: {
        taste: Number(review.ratingTaste),
        value: Number(review.ratingValue),
        portion: Number(review.ratingPortion),
        service: review.ratingService === null ? null : Number(review.ratingService),
      },
      overallRating: Number(review.ratingOverall),
      tags: review.tags.map((item) => item.tag),
      _count: undefined,
      reviewLikes: undefined,
    }))
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
    const normalized = body.ratings ? normalizeRatings(body.ratings) : null
    const normalizedDishName = normalizeDishName(body.dishName)
    const nextTags = body.tags ?? null
    const dedupedTags = nextTags !== null ? Array.from(new Set(nextTags)) : null
    const nextPhotoIds = body.photoIds ?? null
    const dedupedPhotoIds = nextPhotoIds !== null ? Array.from(new Set(nextPhotoIds)) : null

    const review = await prisma.review.findUnique({
      where: { id },
      select: { userId: true, status: true },
    })
    if (!review || review.status === ReviewStatus.DELETED) return err('Review not found', 404)

    // Only the owner can edit
    if (review.userId !== auth.sub) return err('Forbidden', 403)

    if (nextPhotoIds !== null && dedupedPhotoIds !== null) {
      if (nextPhotoIds.length > env.MAX_PHOTOS_PER_REVIEW) {
        return err(`Too many photos - max ${env.MAX_PHOTOS_PER_REVIEW}`, 422)
      }

      if (dedupedPhotoIds.length !== nextPhotoIds.length) {
        return err('Duplicate photo IDs are not allowed', 422)
      }

      if (dedupedPhotoIds.length > 0) {
        const photos = await prisma.photo.findMany({
          where: { id: { in: dedupedPhotoIds }, uploaderId: auth.sub },
          select: {
            id: true,
            moderationStatus: true,
            reviewPhotos: { select: { reviewId: true }, take: 1 },
          },
        })
        if (photos.length !== dedupedPhotoIds.length) {
          return err('One or more photo IDs are invalid', 422)
        }

        const notConfirmed = photos.filter((p) => p.moderationStatus === 'PENDING')
        if (notConfirmed.length > 0) {
          return err('One or more photos are not uploaded yet - please wait for upload confirmation', 409)
        }

        const attachedElsewhere = photos.filter(
          (p) => p.reviewPhotos.length > 0 && p.reviewPhotos[0].reviewId !== id,
        )
        if (attachedElsewhere.length > 0) {
          return err('One or more photos are already attached to another review', 409)
        }
      }
    }

    const reviewData = {
      ...(body.ratings
        ? {
            rating: normalized!.overall,
            ratingTaste: normalized!.taste,
            ratingValue: normalized!.value,
            ratingPortion: normalized!.portion,
            ratingService: normalized!.service,
            ratingOverall: normalized!.overall,
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
      ...(body.dishName !== undefined && { dishName: normalizedDishName }),
    }

    const updated = await prisma.$transaction(async (tx) => {
      const savedReview = await tx.review.update({
        where: { id },
        data: reviewData,
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
          tags: {
            orderBy: { tag: 'asc' },
            select: { tag: true },
          },
        },
      })

      if (dedupedTags !== null) {
        await tx.reviewTag.deleteMany({
          where: { reviewId: id },
        })

        if (dedupedTags.length > 0) {
          await tx.reviewTag.createMany({
            data: dedupedTags.map((tag) => ({
              reviewId: id,
              tag,
            })),
          })
        }
      }

      if (dedupedPhotoIds !== null) {
        await tx.reviewPhoto.deleteMany({
          where: { reviewId: id },
        })

        if (dedupedPhotoIds.length > 0) {
          await tx.reviewPhoto.createMany({
            data: dedupedPhotoIds.map((photoId, i) => ({
              reviewId: id,
              photoId,
              sortOrder: i,
            })),
          })
        }
      }

      return savedReview
    })
    return ok({
      ...updated,
      rating: Number(updated.rating),
      ratings: {
        taste: Number(updated.ratingTaste),
        value: Number(updated.ratingValue),
        portion: Number(updated.ratingPortion),
        service: updated.ratingService === null ? null : Number(updated.ratingService),
      },
      overallRating: Number(updated.ratingOverall),
      tags: updated.tags.map((item) => item.tag),
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
