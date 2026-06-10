import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, parseQuery, requireAuth, serverError, isResponse, withNoStore } from '@/lib/api-helpers'

const BitesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
})

// GET /api/v1/me/bites — the user's own bite log, newest first.
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const query = parseQuery(req, BitesQuerySchema)
  if (isResponse(query)) return query

  try {
    const cursorDate = query.cursor ? new Date(decodeURIComponent(query.cursor)) : null

    const bites = await prisma.bite.findMany({
      where: {
        userId: auth.sub,
        ...(cursorDate && !Number.isNaN(cursorDate.getTime())
          ? { createdAt: { lt: cursorDate } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit + 1,
      select: {
        id: true,
        mealSlot: true,
        note: true,
        visibility: true,
        localDate: true,
        createdAt: true,
        reviewId: true,
        photo: { select: { id: true, variants: true } },
        place: { select: { id: true, name: true } },
      },
    })

    const hasMore = bites.length > query.limit
    const items = hasMore ? bites.slice(0, query.limit) : bites
    const nextCursor = hasMore
      ? encodeURIComponent(items.at(-1)!.createdAt.toISOString())
      : null

    return withNoStore(
      ok({
        data: items.map((b) => ({ ...b, localDate: b.localDate.toISOString().slice(0, 10) })),
        pagination: { nextCursor, hasMore },
      }),
    )
  } catch (e) {
    return serverError('me/bites GET', e)
  }
}
