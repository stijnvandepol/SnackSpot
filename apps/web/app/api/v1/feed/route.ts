import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, parseQuery, serverError, isResponse, getAuthPayload } from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'

const FeedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

function parseCursor(cursorRaw?: string): { createdAt: Date; id: string | null } | null {
  if (!cursorRaw) return null

  try {
    const decoded = decodeURIComponent(cursorRaw)
    const [ts, id] = decoded.split('|')
    const createdAt = new Date(ts)
    if (Number.isNaN(createdAt.getTime())) return null
    return { createdAt, id: id || null }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const auth = getAuthPayload(req)
  const query = parseQuery(req, FeedQuerySchema)
  if (isResponse(query)) return query

  try {
    const cursor = parseCursor(query.cursor)

    const reviews = await prisma.review.findMany({
      where: {
        status: ReviewStatus.PUBLISHED,
        ...(cursor
          ? cursor.id
            ? {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              }
            : { createdAt: { lt: cursor.createdAt } }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: {
        id: true,
        rating: true,
        text: true,
        dishName: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, username: true, avatarKey: true, role: true } },
        place: { select: { id: true, name: true, address: true } },
        _count: { select: { reviewLikes: true } },
        reviewLikes: auth
          ? {
              where: { userId: auth.sub },
              select: { userId: true },
              take: 1,
            }
          : false,
        reviewPhotos: {
          take: 5,
          orderBy: { sortOrder: 'asc' },
          select: {
            photo: { select: { id: true, variants: true } },
          },
        },
      },
    })

    const hasMore = reviews.length > query.limit
    const items = hasMore ? reviews.slice(0, query.limit) : reviews
    const withLikes = items.map((item) => ({
      ...item,
      likeCount: item._count.reviewLikes,
      likedByMe: auth ? item.reviewLikes.length > 0 : false,
      _count: undefined,
      reviewLikes: undefined,
    }))
    const nextCursor = hasMore
      ? encodeURIComponent(`${items.at(-1)!.createdAt.toISOString()}|${items.at(-1)!.id}`)
      : null

    return ok({ data: withLikes, pagination: { nextCursor, hasMore } })
  } catch (e) {
    return serverError('feed', e)
  }
}
