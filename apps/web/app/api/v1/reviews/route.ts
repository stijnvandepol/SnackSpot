import { type NextRequest } from 'next/server'
import { CreateReviewSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { created, err, parseBody, requireAuth, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'
import { normalizeRatings } from '@/lib/ratings'
import { recalculateUserBadges } from '@/lib/badge-service'
import { normalizeDishName } from '@/lib/text'
import { notifyMention } from '@/lib/notification-service'
import { logger } from '@/lib/logger'
import { getBlockedWordsCache, filterText } from '@/lib/blocked-words'
import { validatePhotos, processMentions } from '@/lib/review-helpers'

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const body = await parseBody(req, CreateReviewSchema)
  if (isResponse(body)) return body

  if (!body.placeId && !body.place) {
    return err('Either placeId or place details are required', 422)
  }
  if (body.photoIds.length === 0) {
    return err('At least one photo is required', 422)
  }
  if (body.photoIds.length > env.MAX_PHOTOS_PER_REVIEW) {
    return err(`Too many photos - max ${env.MAX_PHOTOS_PER_REVIEW}`, 422)
  }

  try {
    const normalizedRatings = body.ratings
      ? normalizeRatings(body.ratings)
      : normalizeRatings({
          taste: body.rating!,
          value: body.rating!,
          portion: body.rating!,
          service: null,
        })
    const { regexes } = await getBlockedWordsCache()
    const filteredText = filterText(body.text, regexes)
    const normalizedDishName = normalizeDishName(body.dishName)
    const reviewTags = Array.from(new Set(body.tags))

    let placeId = body.placeId

    // Create place inline if not provided
    if (!placeId && body.place) {
      const p = body.place
      const [created] = await prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO places (name, address, location)
        VALUES (
          ${p.name},
          ${p.address},
          ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography
        )
        RETURNING id
      `
      placeId = created.id
    }

    // Validate photos belong to this user and are not yet attached to any review
    const photoError = await validatePhotos(body.photoIds, auth.sub)
    if (photoError) return photoError

    // Run rate-limit after payload/photo validation so failed attempts don't burn quota as quickly.
    // Allow higher throughput for power users posting multiple reviews in a short session.
    const rl = await rateLimitUser(auth.sub, 'review_create', 60, 3600)
    if (!rl.allowed) return err('Review rate limit exceeded', 429)

    const review = await prisma.review.create({
      data: {
        userId: auth.sub,
        placeId: placeId!,
        rating: normalizedRatings.overall,
        ratingTaste: normalizedRatings.taste,
        ratingValue: normalizedRatings.value,
        ratingPortion: normalizedRatings.portion,
        ratingService: normalizedRatings.service,
        ratingOverall: normalizedRatings.overall,
        text: filteredText,
        dishName: normalizedDishName,
        tags: reviewTags.length > 0
          ? {
              createMany: {
                data: reviewTags.map((tag) => ({ tag })),
              },
            }
          : undefined,
        reviewPhotos: {
          create: body.photoIds.map((photoId, i) => ({ photoId, sortOrder: i })),
        },
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
        status: true,
        createdAt: true,
        tags: {
          orderBy: { tag: 'asc' },
          select: { tag: true },
        },
        place: { select: { id: true, name: true, address: true } },
        reviewPhotos: {
          orderBy: { sortOrder: 'asc' },
          select: { photo: { select: { id: true, variants: true } } },
        },
      },
    })

    await recalculateUserBadges(auth.sub).catch((error) => {
      logger.error({ err: error, userId: auth.sub, reviewId: review.id }, 'Badge recalculation failed after review create')
    })

    // Create mentions and send notifications
    await processMentions(body.text, review.id, auth.sub, body.mentionedUserIds, notifyMention)

    return created({
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
    })
  } catch (e) {
    return serverError('reviews POST', e)
  }
}
