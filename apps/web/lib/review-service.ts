import type { Prisma, Role } from '@prisma/client'
import type { CreateReviewSchema, UpdateReviewSchema } from '@snackspot/shared'
import type { z } from 'zod'
import { prisma } from './db'
import { env } from './env'
import { rateLimit, rateLimitUser } from './rate-limit'
import { normalizeRatings } from './ratings'
import { normalizeDishName } from './text'
import { getBlockedWordsCache, filterText } from './blocked-words'
import { validatePhotos, processMentions } from './review-helpers'
import { recalculateUserBadges } from './badge-service'
import { recalculateCollectibles } from './collectible-service'
import { awardXp } from './xp-service'
import { bumpQuestProgress } from './quest-service'
import { notifyMention } from './notification-service'
import { resolveProviderPlace, resolveManualPlace } from './place-service'
import { logger } from './logger'

// ─── Use-case result ──────────────────────────────────────────────────────────
// The service is transport-agnostic: it returns a domain result that the route
// maps to HTTP. This keeps the orchestration testable without faking Requests.

export type ServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string }

const fail = (status: number, error: string): ServiceResult<never> => ({ ok: false, status, error })

type CreateReviewInput = z.infer<typeof CreateReviewSchema>
type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>

type NormalizedRatings = ReturnType<typeof normalizeRatings>

// ─── Pure transforms (unit-tested without I/O) ─────────────────────────────────

/** Builds the Prisma `data` for a review create from already-normalized inputs. */
export function buildReviewCreateData(params: {
  userId: string
  placeId: string
  ratings: NormalizedRatings
  text: string
  dishName: string | undefined
  tags: string[]
  photoIds: string[]
}): Prisma.ReviewUncheckedCreateInput {
  const { userId, placeId, ratings, text, dishName, tags, photoIds } = params
  return {
    userId,
    placeId,
    rating: ratings.overall,
    ratingTaste: ratings.taste,
    ratingValue: ratings.value,
    ratingPortion: ratings.portion,
    ratingService: ratings.service,
    ratingOverall: ratings.overall,
    text,
    dishName,
    ...(tags.length > 0
      ? { tags: { createMany: { data: tags.map((tag) => ({ tag })) } } }
      : {}),
    reviewPhotos: {
      create: photoIds.map((photoId, i) => ({ photoId, sortOrder: i })),
    },
  }
}

/**
 * Builds the Prisma `data` for a review update. Rating precedence: a full
 * `ratings` object wins; else a single legacy `rating` fans out to every
 * dimension (service cleared); else ratings are left untouched. Text and dish
 * name are only included when the caller sent them.
 */
export function buildReviewUpdateData(params: {
  hasRatings: boolean
  normalizedRatings: NormalizedRatings | null
  singleRating: number | undefined
  filteredText: string | undefined
  hasDishName: boolean
  normalizedDishName: string | undefined
}): Prisma.ReviewUpdateInput {
  const { hasRatings, normalizedRatings, singleRating, filteredText, hasDishName, normalizedDishName } = params
  return {
    ...(hasRatings && normalizedRatings
      ? {
          rating: normalizedRatings.overall,
          ratingTaste: normalizedRatings.taste,
          ratingValue: normalizedRatings.value,
          ratingPortion: normalizedRatings.portion,
          ratingService: normalizedRatings.service,
          ratingOverall: normalizedRatings.overall,
        }
      : singleRating !== undefined
        ? {
            rating: singleRating,
            ratingTaste: singleRating,
            ratingValue: singleRating,
            ratingPortion: singleRating,
            ratingService: null,
            ratingOverall: singleRating,
          }
        : {}),
    ...(filteredText !== undefined && { text: filteredText }),
    ...(hasDishName && { dishName: normalizedDishName }),
  }
}

// Decimal → number serialization shared by create/update responses.
interface RawRatingFields {
  rating: Prisma.Decimal | number
  ratingTaste: Prisma.Decimal | number
  ratingValue: Prisma.Decimal | number
  ratingPortion: Prisma.Decimal | number
  ratingService: Prisma.Decimal | number | null
  ratingOverall: Prisma.Decimal | number
  tags: Array<{ tag: string }>
}

function serializeRatings<T extends RawRatingFields>(review: T) {
  return {
    ...review,
    rating: Number(review.rating),
    ratings: {
      taste: Number(review.ratingTaste),
      value: Number(review.ratingValue),
      portion: Number(review.ratingPortion),
      service: review.ratingService === null ? null : Number(review.ratingService),
    },
    overallRating: Number(review.ratingOverall),
    tags: review.tags.map((item) => item.tag),
  }
}

// ─── Place resolution ──────────────────────────────────────────────────────────

async function resolvePlaceId(
  input: CreateReviewInput,
  role: Role,
): Promise<ServiceResult<string>> {
  if (input.placeId) return { ok: true, value: input.placeId }

  if (input.verifiedPlace) {
    const resolved = await resolveProviderPlace(input.verifiedPlace, { verify: true })
    if ('error' in resolved) return fail(422, resolved.error)
    return { ok: true, value: resolved.id }
  }

  if (input.place) {
    // Free-text place creation bypasses venue verification, so it is restricted
    // to moderators/admins. Regular users must pick a verified venue.
    if (role !== 'ADMIN' && role !== 'MODERATOR') {
      return fail(422, 'Pick a verified place from the list instead of free text')
    }
    const resolved = await resolveManualPlace(input.place)
    return { ok: true, value: resolved.id }
  }

  return fail(422, 'A place is required: pick one or select a verified venue')
}

// ─── Create ────────────────────────────────────────────────────────────────────

export async function createReview(params: {
  userId: string
  role: Role
  input: CreateReviewInput
}): Promise<ServiceResult<ReturnType<typeof serializeRatings>>> {
  const { userId, role, input } = params

  if (input.photoIds.length === 0) return fail(422, 'At least one photo is required')
  if (input.photoIds.length > env.MAX_PHOTOS_PER_REVIEW) {
    return fail(422, `Too many photos - max ${env.MAX_PHOTOS_PER_REVIEW}`)
  }

  const normalizedRatings = input.ratings
    ? normalizeRatings(input.ratings)
    : normalizeRatings({ taste: input.rating!, value: input.rating!, portion: input.rating!, service: null })
  const { regexes } = await getBlockedWordsCache()
  const filteredText = filterText(input.text, regexes)
  const normalizedDishName = normalizeDishName(input.dishName)
  const tags = Array.from(new Set(input.tags))

  const place = await resolvePlaceId(input, role)
  if (!place.ok) return place
  const placeId = place.value

  // Validate photos before consuming rate-limit quota, so rejected attempts
  // don't burn the budget as fast.
  const photoError = await validatePhotos(input.photoIds, userId)
  if (photoError) return fail(photoError.status, photoError.error)

  const rl = await rateLimitUser(userId, 'review_create', 60, 3600)
  if (!rl.allowed) return fail(429, 'Review rate limit exceeded')

  // Per-place limit: max 5 reviews per user per place per day.
  const placeRl = await rateLimit(`rl:place_review:${userId}:${placeId}`, 5, 86400)
  if (!placeRl.allowed) return fail(429, 'Too many reviews for this place')

  const review = await prisma.review.create({
    data: buildReviewCreateData({
      userId,
      placeId,
      ratings: normalizedRatings,
      text: filteredText,
      dishName: normalizedDishName,
      tags,
      photoIds: input.photoIds,
    }),
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
      tags: { orderBy: { tag: 'asc' }, select: { tag: true } },
      place: { select: { id: true, name: true, address: true } },
      reviewPhotos: {
        orderBy: { sortOrder: 'asc' },
        select: { photo: { select: { id: true, variants: true } } },
      },
    },
  })

  // XP: base award + photo bonus, plus the "First Bite" discovery bonus for the
  // very first published review of a place. awardXp never throws.
  const isFirstReviewOfPlace =
    (await prisma.review.count({
      where: { placeId, status: 'PUBLISHED', id: { not: review.id } },
    })) === 0
  await Promise.all([
    awardXp({ userId, reason: 'REVIEW_CREATED', refType: 'review', refId: review.id }),
    awardXp({ userId, reason: 'REVIEW_PHOTO_BONUS', refType: 'review', refId: review.id }),
    ...(isFirstReviewOfPlace
      ? [awardXp({ userId, reason: 'FIRST_REVIEW_OF_PLACE', refType: 'place', refId: placeId })]
      : []),
    bumpQuestProgress(userId, 'REVIEWS_POSTED'),
  ])

  // Badge/passport failures must never roll back a review.
  await Promise.all([
    recalculateUserBadges(userId).catch((error) => {
      logger.error({ err: error, userId, reviewId: review.id }, 'Badge recalculation failed after review create')
    }),
    recalculateCollectibles(userId), // never throws
  ])

  await processMentions(input.text, review.id, userId, input.mentionedUserIds, notifyMention)

  return { ok: true, value: serializeRatings(review) }
}

// ─── Update ────────────────────────────────────────────────────────────────────

export async function updateReview(params: {
  userId: string
  reviewId: string
  input: UpdateReviewInput
}): Promise<ServiceResult<ReturnType<typeof serializeRatings>>> {
  const { userId, reviewId, input } = params

  const normalized = input.ratings ? normalizeRatings(input.ratings) : null
  const normalizedDishName = normalizeDishName(input.dishName)
  const { regexes } = await getBlockedWordsCache()
  const filteredText = input.text !== undefined ? filterText(input.text, regexes) : undefined
  const dedupedTags = input.tags != null ? Array.from(new Set(input.tags)) : null
  const nextPhotoIds = input.photoIds ?? null
  const dedupedPhotoIds = nextPhotoIds !== null ? Array.from(new Set(nextPhotoIds)) : null

  const existing = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { userId: true, status: true },
  })
  if (!existing || existing.status === 'DELETED') return fail(404, 'Review not found')
  if (existing.userId !== userId) return fail(403, 'Forbidden')

  if (nextPhotoIds !== null && dedupedPhotoIds !== null) {
    if (nextPhotoIds.length > env.MAX_PHOTOS_PER_REVIEW) {
      return fail(422, `Too many photos - max ${env.MAX_PHOTOS_PER_REVIEW}`)
    }
    if (dedupedPhotoIds.length !== nextPhotoIds.length) {
      return fail(422, 'Duplicate photo IDs are not allowed')
    }
    if (dedupedPhotoIds.length > 0) {
      const photoError = await validatePhotos(dedupedPhotoIds, userId, reviewId)
      if (photoError) return fail(photoError.status, photoError.error)
    }
  }

  const reviewData = buildReviewUpdateData({
    hasRatings: Boolean(input.ratings),
    normalizedRatings: normalized,
    singleRating: input.rating,
    filteredText,
    hasDishName: input.dishName !== undefined,
    normalizedDishName,
  })

  const updated = await prisma.$transaction(async (tx) => {
    const savedReview = await tx.review.update({
      where: { id: reviewId },
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
        tags: { orderBy: { tag: 'asc' }, select: { tag: true } },
      },
    })

    if (dedupedTags !== null) {
      await tx.reviewTag.deleteMany({ where: { reviewId } })
      if (dedupedTags.length > 0) {
        await tx.reviewTag.createMany({ data: dedupedTags.map((tag) => ({ reviewId, tag })) })
      }
    }

    if (dedupedPhotoIds !== null) {
      await tx.reviewPhoto.deleteMany({ where: { reviewId } })
      if (dedupedPhotoIds.length > 0) {
        await tx.reviewPhoto.createMany({
          data: dedupedPhotoIds.map((photoId, i) => ({ reviewId, photoId, sortOrder: i })),
        })
      }
    }

    return savedReview
  })

  return { ok: true, value: serializeRatings(updated) }
}
