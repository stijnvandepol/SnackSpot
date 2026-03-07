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

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  // Rate limit: 20 reviews per hour per user
  const rl = await rateLimitUser(auth.sub, 'review_create', 20, 3600)
  if (!rl.allowed) return err('Review rate limit exceeded', 429)

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
    const normalizedDishName = normalizeDishName(body.dishName)

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
    if (body.photoIds.length > 0) {
      const photos = await prisma.photo.findMany({
        where: { id: { in: body.photoIds }, uploaderId: auth.sub },
        select: {
          id: true,
          moderationStatus: true,
          reviewPhotos: { select: { reviewId: true }, take: 1 },
        },
      })
      if (photos.length !== body.photoIds.length) {
        return err('One or more photo IDs are invalid', 422)
      }
      const notConfirmed = photos.filter((p) => p.moderationStatus === 'PENDING')
      if (notConfirmed.length > 0) {
        return err('One or more photos are not uploaded yet - please wait for upload confirmation', 409)
      }
      const alreadyUsed = photos.filter((p) => p.reviewPhotos.length > 0)
      if (alreadyUsed.length > 0) {
        return err('One or more photos are already attached to a review', 409)
      }
    }

    const review = await prisma.review.create({
      data: {
        userId: auth.sub,
        placeId: placeId!,
        rating: Math.round(normalizedRatings.overall),
        ratingTaste: normalizedRatings.taste,
        ratingValue: normalizedRatings.value,
        ratingPortion: normalizedRatings.portion,
        ratingService: normalizedRatings.service,
        ratingOverall: normalizedRatings.overall,
        text: body.text,
        dishName: normalizedDishName,
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
        place: { select: { id: true, name: true, address: true } },
        reviewPhotos: {
          orderBy: { sortOrder: 'asc' },
          select: { photo: { select: { id: true, variants: true } } },
        },
      },
    })

    await recalculateUserBadges(auth.sub)

    // Create mentions and send notifications
    const mentionMatches = body.text.match(/@(\w{3,30})/g) ?? []
    const mentionedUsernames = [...new Set(mentionMatches.map((m) => m.slice(1).toLowerCase()))]

    const mentionedUsersByUsername = mentionedUsernames.length > 0
      ? await prisma.user.findMany({
          where: {
            bannedAt: null,
            OR: mentionedUsernames.map((username) => ({
              username: { equals: username, mode: 'insensitive' },
            })),
          },
          select: { id: true },
        })
      : []

    const mentionedUserIds = [
      ...new Set([
        ...body.mentionedUserIds,
        ...mentionedUsersByUsername.map((u) => u.id),
      ]),
    ].filter((id) => id !== auth.sub)

    if (mentionedUserIds.length > 0) {
      const validUsers = await prisma.user.findMany({
        where: { id: { in: mentionedUserIds }, bannedAt: null },
        select: { id: true },
      })

      const validUserIds = validUsers.map((u) => u.id)

      await prisma.reviewMention.createMany({
        data: validUserIds.map((userId) => ({
          reviewId: review.id,
          mentionedUserId: userId,
          mentionedByUserId: auth.sub,
        })),
        skipDuplicates: true,
      })

      for (const userId of validUserIds) {
        await notifyMention(userId, review.id, auth.sub)
      }
    }

    return created({
      ...review,
      ratings: {
        taste: review.ratingTaste,
        value: review.ratingValue,
        portion: review.ratingPortion,
        service: review.ratingService,
      },
      overallRating: Number(review.ratingOverall),
    })
  } catch (e) {
    return serverError('reviews POST', e)
  }
}
