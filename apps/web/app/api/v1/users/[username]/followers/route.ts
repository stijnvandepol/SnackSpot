import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, err, getAuthPayload, serverError, isResponse, parseQuery, withNoStore } from '@/lib/api-helpers'

const QuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

async function resolveUser(username: string) {
  return prisma.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' }, bannedAt: null },
    select: { id: true },
  })
}

// GET /api/v1/users/[username]/followers — people who follow [username].
// Public list; when authenticated each row carries viewerFollows for follow-back.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params
  const auth = getAuthPayload(req)

  const query = parseQuery(req, QuerySchema)
  if (isResponse(query)) return query

  try {
    const target = await resolveUser(username)
    if (!target) return err('User not found', 404)

    const rows = await prisma.follow.findMany({
      where: { followeeId: target.id },
      orderBy: { createdAt: 'desc' },
      take: query.limit + 1,
      ...(query.cursor
        ? {
            cursor: { followerId_followeeId: { followerId: query.cursor, followeeId: target.id } },
            skip: 1,
          }
        : {}),
      select: {
        followerId: true,
        follower: { select: { username: true, avatarKey: true, isVerified: true, bio: true } },
      },
    })

    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows
    const nextCursor = hasMore ? page[page.length - 1].followerId : null

    const viewerFollows = await resolveViewerFollows(auth?.sub, page.map((r) => r.followerId))

    return withNoStore(
      ok({
        data: page.map((r) => ({
          username: r.follower.username,
          avatarKey: r.follower.avatarKey,
          isVerified: r.follower.isVerified,
          bio: r.follower.bio,
          viewerFollows: viewerFollows.has(r.followerId),
        })),
        pagination: { nextCursor, hasMore },
      }),
    )
  } catch (e) {
    return serverError('users/[username]/followers GET', e)
  }
}

/** Of the given user ids, which does the viewer already follow? Empty when anonymous. */
async function resolveViewerFollows(viewerId: string | undefined, ids: string[]): Promise<Set<string>> {
  if (!viewerId || ids.length === 0) return new Set()
  const mine = await prisma.follow.findMany({
    where: { followerId: viewerId, followeeId: { in: ids } },
    select: { followeeId: true },
  })
  return new Set(mine.map((m) => m.followeeId))
}
