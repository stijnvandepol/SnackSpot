import { type NextRequest } from 'next/server'
import { Prisma, ReviewStatus } from '@prisma/client'
import { ReviewTagSchema } from '@snackspot/shared'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  getAuthPayload,
  isResponse,
  ok,
  parseQuery,
  serverError,
  withNoStore,
  withPublicCache,
} from '@/lib/api-helpers'

const DiscoverQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).default(4),
  tag: ReviewTagSchema.optional(),
})

const reviewSelect = {
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
    orderBy: { tag: 'asc' as const },
    select: { tag: true },
  },
  user: { select: { id: true, username: true, avatarKey: true, role: true } },
  place: { select: { id: true, name: true, address: true } },
  _count: { select: { reviewLikes: true, comments: true } },
  reviewLikes: {
    where: { userId: '__no_user__' },
    select: { userId: true },
    take: 1,
  },
  reviewPhotos: {
    take: 5,
    orderBy: { sortOrder: 'asc' as const },
    select: {
      photo: { select: { id: true, variants: true } },
    },
  },
}

function serializeReview(item: any) {
  return {
    ...item,
    rating: Number(item.rating),
    likeCount: item._count.reviewLikes,
    commentCount: item._count.comments,
    likedByMe: item.reviewLikes.length > 0,
    ratings: {
      taste: Number(item.ratingTaste),
      value: Number(item.ratingValue),
      portion: Number(item.ratingPortion),
      service: item.ratingService === null ? null : Number(item.ratingService),
    },
    overallRating: Number(item.ratingOverall),
    tags: item.tags.map((tag: { tag: string }) => tag.tag),
    _count: undefined,
    reviewLikes: undefined,
  }
}

async function getReviewsByIds(ids: string[], authSub?: string) {
  if (ids.length === 0) return []

  const reviews = await prisma.review.findMany({
    where: { id: { in: ids } },
    select: {
      ...reviewSelect,
      reviewLikes: {
        where: { userId: authSub ?? '__no_user__' },
        select: { userId: true },
        take: 1,
      },
    },
  })

  const byId = new Map(reviews.map((review) => [review.id, serializeReview(review)]))
  return ids.map((id) => byId.get(id)).filter(Boolean)
}

export async function GET(req: NextRequest) {
  const auth = getAuthPayload(req)
  const query = parseQuery(req, DiscoverQuerySchema)
  if (isResponse(query)) return query

  try {
    const tagFilter = query.tag
      ? {
          tags: {
            some: {
              tag: query.tag,
            },
          },
        }
      : {}

    const freshFinds = await prisma.review.findMany({
      where: {
        status: ReviewStatus.PUBLISHED,
        ...tagFilter,
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      select: {
        ...reviewSelect,
        reviewLikes: {
          where: { userId: auth?.sub ?? '__no_user__' },
          select: { userId: true },
          take: 1,
        },
      },
    })

    const underTheRadarRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT r.id
      FROM reviews r
      JOIN (
        SELECT place_id, COUNT(*)::int AS review_count
        FROM reviews
        WHERE status = ${ReviewStatus.PUBLISHED}
        GROUP BY place_id
      ) place_counts ON place_counts.place_id = r.place_id
      WHERE r.status = ${ReviewStatus.PUBLISHED}
      ${query.tag
        ? Prisma.sql`AND EXISTS (
            SELECT 1
            FROM review_tags rt
            WHERE rt.review_id = r.id
              AND rt.tag = ${query.tag}
          )`
        : Prisma.empty}
      ORDER BY place_counts.review_count ASC, r.created_at DESC
      LIMIT ${query.limit * 3}
    `)

    const freshFindIds = new Set(freshFinds.map((review) => review.id))
    const underTheRadarIds = underTheRadarRows
      .map((row) => row.id)
      .filter((id) => !freshFindIds.has(id))
      .slice(0, query.limit)

    const underTheRadar = await getReviewsByIds(underTheRadarIds, auth?.sub)

    const res = ok({
      freshFinds: freshFinds.map(serializeReview),
      underTheRadar,
    })

    return auth ? withNoStore(res) : withPublicCache(res, 20, 60)
  } catch (e) {
    return serverError('discover', e)
  }
}
