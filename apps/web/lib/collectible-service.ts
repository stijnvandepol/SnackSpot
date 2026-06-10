import { prisma } from './db'
import { logger } from './logger'

// ─── Criteria evaluation ─────────────────────────────────────────────────────
// Criteria live in JSONB on the collectible so new sets ship as content:
//   { type: 'DISH_MATCH',      patterns: string[] } — reviewed dish name contains a pattern
//   { type: 'UNIQUE_PLACES',   value: number }      — distinct places reviewed
//   { type: 'UNIQUE_CITIES',   value: number }      — distinct cities reviewed
//   { type: 'CUISINE_MATCH',   cuisine: string }    — reviewed a place with this cuisine
//   { type: 'UNIQUE_CUISINES', value: number }      — distinct cuisines reviewed

interface CollectibleFacts {
  dishNames: string[]
  uniquePlaces: number
  uniqueCities: number
  cuisines: Set<string>
}

function criteriaMet(criteria: unknown, facts: CollectibleFacts): boolean {
  if (!criteria || typeof criteria !== 'object') return false
  const c = criteria as { type?: string; patterns?: unknown; value?: unknown; cuisine?: unknown }

  switch (c.type) {
    case 'DISH_MATCH': {
      if (!Array.isArray(c.patterns)) return false
      const patterns = c.patterns.filter((p): p is string => typeof p === 'string')
      return facts.dishNames.some((dish) => patterns.some((p) => dish.includes(p)))
    }
    case 'UNIQUE_PLACES':
      return typeof c.value === 'number' && facts.uniquePlaces >= c.value
    case 'UNIQUE_CITIES':
      return typeof c.value === 'number' && facts.uniqueCities >= c.value
    case 'CUISINE_MATCH':
      return typeof c.cuisine === 'string' && facts.cuisines.has(c.cuisine)
    case 'UNIQUE_CUISINES':
      return typeof c.value === 'number' && facts.cuisines.size >= c.value
    default:
      return false
  }
}

async function gatherFacts(userId: string): Promise<CollectibleFacts> {
  const [dishRows, placeRows] = await Promise.all([
    prisma.$queryRaw<Array<{ dish: string }>>`
      SELECT DISTINCT LOWER(TRIM(dish_name)) AS dish
      FROM reviews
      WHERE user_id = ${userId} AND status = 'PUBLISHED'
        AND dish_name IS NOT NULL AND LENGTH(TRIM(dish_name)) > 0
    `,
    prisma.$queryRaw<Array<{ place_id: string; city: string | null; cuisine: string | null }>>`
      SELECT DISTINCT r.place_id, p.city, p.cuisine
      FROM reviews r
      INNER JOIN places p ON p.id = r.place_id
      WHERE r.user_id = ${userId} AND r.status = 'PUBLISHED'
    `,
  ])

  const cities = new Set<string>()
  const cuisines = new Set<string>()
  for (const row of placeRows) {
    if (row.city) cities.add(row.city.toLowerCase())
    if (row.cuisine) cuisines.add(row.cuisine.toLowerCase())
  }

  return {
    dishNames: dishRows.map((r) => r.dish),
    uniquePlaces: placeRows.length,
    uniqueCities: cities.size,
    cuisines,
  }
}

export interface EarnedCollectible {
  setKey: string
  itemKey: string
  name: string
  icon: string
}

/**
 * Re-evaluates all active collectibles for the user and awards anything newly
 * earned. Idempotent (insert with skipDuplicates) and never throws — passport
 * stamps must not break the action that earned them. Returns the new stamps.
 */
export async function recalculateCollectibles(userId: string): Promise<EarnedCollectible[]> {
  try {
    const [collectibles, owned] = await Promise.all([
      prisma.collectible.findMany({ where: { active: true } }),
      prisma.userCollectible.findMany({ where: { userId }, select: { collectibleId: true } }),
    ])

    const ownedIds = new Set(owned.map((o) => o.collectibleId))
    const candidates = collectibles.filter((c) => !ownedIds.has(c.id))
    if (candidates.length === 0) return []

    const facts = await gatherFacts(userId)
    const earned = candidates.filter((c) => criteriaMet(c.criteria, facts))
    if (earned.length === 0) return []

    await prisma.userCollectible.createMany({
      data: earned.map((c) => ({ userId, collectibleId: c.id })),
      skipDuplicates: true,
    })

    return earned.map((c) => ({ setKey: c.setKey, itemKey: c.itemKey, name: c.name, icon: c.icon }))
  } catch (err) {
    logger.error({ err, userId }, 'Collectible recalculation failed')
    return []
  }
}

/** Display titles per set, in passport order. */
export const COLLECTIBLE_SETS: ReadonlyArray<{ key: string; title: string }> = [
  { key: 'dutch-classics', title: 'De Hollandse Vijf' },
  { key: 'world-tour', title: 'World tour' },
  { key: 'taste-tourist', title: 'Taste tourist' },
  { key: 'spot-milestones', title: 'Spot milestones' },
  { key: 'city-explorer', title: 'City explorer' },
]
