import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, requireAuth, serverError, isResponse, withNoStore } from '@/lib/api-helpers'

const WINDOW_HOURS = 24

// GET /api/v1/me/friends-bites — recent bites from mutual follows ("friends")
// plus the user's own, for the friends strip on the following feed.
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  try {
    // Mutual follows: people I follow who also follow me.
    const mutualRows = await prisma.$queryRaw<Array<{ user_id: string }>>`
      SELECT f1.followee_id AS user_id
      FROM follows f1
      INNER JOIN follows f2
        ON f2.follower_id = f1.followee_id AND f2.followee_id = f1.follower_id
      WHERE f1.follower_id = ${auth.sub}
    `
    const visibleUserIds = [auth.sub, ...mutualRows.map((r) => r.user_id)]
    const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000)

    const bites = await prisma.bite.findMany({
      where: {
        createdAt: { gte: since },
        OR: [
          { userId: auth.sub },
          { userId: { in: visibleUserIds }, visibility: 'FRIENDS' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        mealSlot: true,
        note: true,
        createdAt: true,
        user: { select: { id: true, username: true, avatarKey: true } },
        photo: { select: { id: true, variants: true } },
        place: { select: { id: true, name: true } },
      },
    })

    return withNoStore(ok({ data: bites }))
  } catch (e) {
    return serverError('me/friends-bites GET', e)
  }
}
