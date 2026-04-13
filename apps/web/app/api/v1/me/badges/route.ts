import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, requireAuth, serverError, isResponse, withNoStore } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  try {
    const rows = await prisma.userBadge.findMany({
      where: { userId: auth.sub, badge: { isActive: true } },
      orderBy: [{ earnedAt: 'desc' }, { createdAt: 'asc' }],
      select: {
        progressCurrent: true,
        progressTarget: true,
        earnedAt: true,
        badge: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            iconKey: true,
            tier: true,
            criteriaType: true,
            criteriaValue: true,
          },
        },
      },
    })

    const earned = rows.filter((r: (typeof rows)[number]) => Boolean(r.earnedAt))
    const inProgress = rows.filter((r: (typeof rows)[number]) => !r.earnedAt)

    return withNoStore(ok({ earned, inProgress }))
  } catch (e) {
    return serverError('me/badges GET', e)
  }
}
