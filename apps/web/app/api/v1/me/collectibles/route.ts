import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, requireAuth, serverError, isResponse, withNoStore } from '@/lib/api-helpers'
import { COLLECTIBLE_SETS } from '@/lib/collectible-service'

// GET /api/v1/me/collectibles — the Food Passport: every active stamp,
// grouped per set, with earned state (unearned stamps render as silhouettes).
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  try {
    const [collectibles, owned] = await Promise.all([
      prisma.collectible.findMany({
        where: { active: true },
        orderBy: [{ setKey: 'asc' }, { sortOrder: 'asc' }],
      }),
      prisma.userCollectible.findMany({ where: { userId: auth.sub } }),
    ])

    const earnedAtById = new Map(owned.map((o) => [o.collectibleId, o.earnedAt]))

    const sets = COLLECTIBLE_SETS.map(({ key, title }) => {
      const items = collectibles
        .filter((c) => c.setKey === key)
        .map((c) => ({
          key: c.itemKey,
          name: c.name,
          description: c.description,
          icon: c.icon,
          earned: earnedAtById.has(c.id),
          earnedAt: earnedAtById.get(c.id)?.toISOString() ?? null,
        }))
      return {
        key,
        title,
        earnedCount: items.filter((i) => i.earned).length,
        totalCount: items.length,
        items,
      }
    }).filter((set) => set.totalCount > 0)

    return withNoStore(ok({ data: sets }))
  } catch (e) {
    return serverError('me/collectibles GET', e)
  }
}
