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
import { getBlockedWords, filterText } from '@/lib/blocked-words'
import { reviewListSelect, serializeReview, checkReviewVisibility, validatePhotos } from '@/lib/review-helpers'

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
        ...reviewListSelect(auth?.sub),
        updatedAt: true,
        reviewPhotos: {
          orderBy: { sortOrder: 'asc' as const },
          select: { sortOrder: true, photo: { select: { id: true, variants: true } } },
        },
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
    const normalized = body.ratings ? normalizeRatings(body.ratings) : null
    const normalizedDishName = normalizeDishName(body.dishName)
    const blockedWords = await getBlockedWords()
    const filteredText = body.text !== undefined ? filterText(body.text, blockedWords) : undefined
    const nextTags = body.tags ?? null
    const dedupedTags = nextTags !== null ? Array.from(new Set(nextTags)) : null
    const nextPhotoIds = body.photoIds ?? null
    const dedupedPhotoIds = nextPhotoIds !== null ? Array.from(new Set(nextPhotoIds)) : null

    const review = await prisma.review.findUnique({
      where: { id },
      select: { userId: true, status: true },
    })
    if (!review || review.status === ReviewStatus.DELETED) return err('Review not found', 404)

    if (review.userId !== auth.sub) return err('Forbidden', 403)

    if (nextPhotoIds !== null && dedupedPhotoIds !== null) {
      if (nextPhotoIds.length > env.MAX_PHOTOS_PER_REVIEW) {
        return err(`Too many photos - max ${env.MAX_PHOTOS_PER_REVIEW}`, 422)
      }

      if (dedupedPhotoIds.length !== nextPhotoIds.length) {
        return err('Duplicate photo IDs are not allowed', 422)
      }

      if (dedupedPhotoIds.length > 0) {
        const photoError = await validatePhotos(dedupedPhotoIds, auth.sub, id)
        if (photoError) return photoError
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
      ...(filteredText !== undefined && { text: filteredText }),
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
