import { type NextRequest } from 'next/server'
import { CreateReviewSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { created, err, parseBody, requireAuth, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'

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
  if (body.photoIds.length > env.MAX_PHOTOS_PER_REVIEW) {
    return err(`Too many photos - max ${env.MAX_PHOTOS_PER_REVIEW}`, 422)
  }

  try {
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
        rating: body.rating,
        text: body.text,
        dishName: body.dishName,
        reviewPhotos: {
          create: body.photoIds.map((photoId, i) => ({ photoId, sortOrder: i })),
        },
      },
      select: {
        id: true,
        rating: true,
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

    return created(review)
  } catch (e) {
    return serverError('reviews POST', e)
  }
}
