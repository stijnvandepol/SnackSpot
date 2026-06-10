import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, err, requireAuth, getAuthPayload, serverError, isResponse, withNoStore } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'

async function resolveUser(username: string) {
  return prisma.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' }, bannedAt: null },
    select: { id: true },
  })
}

// GET /api/v1/users/[username]/follow — follow status + counts.
// Public: counts always; following/followsMe only when authenticated.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params
  const auth = getAuthPayload(req)

  try {
    const target = await resolveUser(username)
    if (!target) return err('User not found', 404)

    const [followerCount, followingCount, following, followsMe] = await Promise.all([
      prisma.follow.count({ where: { followeeId: target.id } }),
      prisma.follow.count({ where: { followerId: target.id } }),
      auth
        ? prisma.follow.findUnique({
            where: { followerId_followeeId: { followerId: auth.sub, followeeId: target.id } },
            select: { followerId: true },
          })
        : null,
      auth
        ? prisma.follow.findUnique({
            where: { followerId_followeeId: { followerId: target.id, followeeId: auth.sub } },
            select: { followerId: true },
          })
        : null,
    ])

    return withNoStore(
      ok({
        followerCount,
        followingCount,
        following: Boolean(following),
        followsMe: Boolean(followsMe),
      }),
    )
  } catch (e) {
    return serverError('users/[username]/follow GET', e)
  }
}

// POST /api/v1/users/[username]/follow — follow (idempotent).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth
  const { username } = await params

  try {
    const rl = await rateLimitUser(auth.sub, 'follow', 60, 3600)
    if (!rl.allowed) return err('Too many follow actions', 429)

    const target = await resolveUser(username)
    if (!target) return err('User not found', 404)
    if (target.id === auth.sub) return err('You cannot follow yourself', 422)

    await prisma.follow.createMany({
      data: [{ followerId: auth.sub, followeeId: target.id }],
      skipDuplicates: true,
    })

    const followerCount = await prisma.follow.count({ where: { followeeId: target.id } })
    return ok({ following: true, followerCount })
  } catch (e) {
    return serverError('users/[username]/follow POST', e)
  }
}

// DELETE /api/v1/users/[username]/follow — unfollow (idempotent).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth
  const { username } = await params

  try {
    const target = await resolveUser(username)
    if (!target) return err('User not found', 404)

    await prisma.follow.deleteMany({
      where: { followerId: auth.sub, followeeId: target.id },
    })

    const followerCount = await prisma.follow.count({ where: { followeeId: target.id } })
    return ok({ following: false, followerCount })
  } catch (e) {
    return serverError('users/[username]/follow DELETE', e)
  }
}
