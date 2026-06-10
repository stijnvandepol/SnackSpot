import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, requireAuth, serverError, isResponse, withNoStore } from '@/lib/api-helpers'

/** Monday 00:00 UTC of the current week — leaderboards reset weekly. */
function startOfIsoWeek(): Date {
  const now = new Date()
  const day = now.getUTCDay() // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff))
  return monday
}

// GET /api/v1/leaderboard — weekly XP among the user and the people they follow.
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  try {
    const followees = await prisma.follow.findMany({
      where: { followerId: auth.sub },
      select: { followeeId: true },
    })
    const userIds = [auth.sub, ...followees.map((f) => f.followeeId)]
    const weekStart = startOfIsoWeek()

    const [sums, users] = await Promise.all([
      prisma.xpEvent.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, createdAt: { gte: weekStart } },
        _sum: { amount: true },
      }),
      prisma.user.findMany({
        where: { id: { in: userIds }, bannedAt: null },
        select: { id: true, username: true, avatarKey: true, isVerified: true },
      }),
    ])

    const xpByUser = new Map(sums.map((s) => [s.userId, s._sum.amount ?? 0]))
    const rows = users
      .map((u) => ({
        id: u.id,
        username: u.username,
        avatarKey: u.avatarKey,
        isVerified: u.isVerified,
        weeklyXp: xpByUser.get(u.id) ?? 0,
        isMe: u.id === auth.sub,
      }))
      .sort((a, b) => b.weeklyXp - a.weeklyXp || a.username.localeCompare(b.username))
      .slice(0, 20)
      .map((row, i) => ({ ...row, rank: i + 1 }))

    return withNoStore(ok({ weekStart: weekStart.toISOString(), data: rows }))
  } catch (e) {
    return serverError('leaderboard GET', e)
  }
}
