import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === code
  )
}

// ─── XP economy ──────────────────────────────────────────────────────────────
// Amounts are deliberately weighted toward value creation (reviews, first
// review of a place) over raw volume; repeatable actions carry daily caps so
// the feed cannot be farmed for XP.

export const XP_AMOUNTS = {
  BITE_LOGGED: 10,
  REVIEW_CREATED: 50,
  REVIEW_PHOTO_BONUS: 25,
  FIRST_REVIEW_OF_PLACE: 100,
  LIKE_RECEIVED: 2,
  COMMENT_POSTED: 5,
  // Quests carry their own reward; awardXp is called with an explicit amount.
  QUEST_COMPLETED: 0,
} as const

export type XpReason = keyof typeof XP_AMOUNTS

/** Max XP-bearing events per UTC day for repeatable reasons. */
export const XP_DAILY_EVENT_CAPS: Partial<Record<XpReason, number>> = {
  BITE_LOGGED: 3,
  LIKE_RECEIVED: 10,
  COMMENT_POSTED: 10,
}

// ─── Level curve ─────────────────────────────────────────────────────────────
// Cumulative XP required for level n: 100 * (n-1)^1.6. Early levels come fast
// (level 2 at 100 XP ≈ two reviews), later levels stretch out.

export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  // ceil keeps the integer threshold at or above the exact curve, so
  // levelForXp(xpForLevel(n)) === n holds for every level. The small epsilon
  // compensates for Math.pow float error on exact-integer results
  // (e.g. 32^1.6 === 256 exactly, but Math.pow returns 256.0000000000004).
  return Math.ceil(100 * Math.pow(level - 1, 1.6) - 1e-6)
}

export function levelForXp(xp: number): number {
  if (xp <= 0) return 1
  // Epsilon compensates for the Math.round in xpForLevel so the functions
  // stay exact inverses at the thresholds.
  return Math.floor(Math.pow(xp / 100, 1 / 1.6) + 1e-9) + 1
}

const LEVEL_TITLES: ReadonlyArray<readonly [number, string]> = [
  [1, 'Snacker'],
  [3, 'Taster'],
  [5, 'Foodie'],
  [8, 'Local Explorer'],
  [12, 'Connoisseur'],
  [16, 'Gem Hunter'],
  [20, 'Food Legend'],
]

export function levelTitle(level: number): string {
  let title = LEVEL_TITLES[0][1]
  for (const [threshold, name] of LEVEL_TITLES) {
    if (level >= threshold) title = name
  }
  return title
}

export interface XpProgress {
  total: number
  level: number
  title: string
  /** Cumulative XP where the current level started. */
  currentLevelXp: number
  /** Cumulative XP needed for the next level. */
  nextLevelXp: number
  /** 0–100 progress within the current level. */
  progressPct: number
}

export function xpProgress(total: number): XpProgress {
  const level = levelForXp(total)
  const currentLevelXp = xpForLevel(level)
  const nextLevelXp = xpForLevel(level + 1)
  const span = Math.max(1, nextLevelXp - currentLevelXp)
  return {
    total,
    level,
    title: levelTitle(level),
    currentLevelXp,
    nextLevelXp,
    progressPct: Math.min(100, Math.round(((total - currentLevelXp) / span) * 100)),
  }
}

// ─── Awarding ────────────────────────────────────────────────────────────────

export interface XpAward {
  awarded: number
  xpTotal: number
  level: number
  leveledUp: boolean
}

function startOfUtcDay(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/**
 * Awards XP and keeps user_stats in sync. Never throws: XP is a side effect
 * and must not break the action that earned it. Returns null when nothing was
 * awarded (duplicate ref, daily cap hit, or an internal error).
 *
 * Always pass a refId for repeatable reasons — the unique
 * (user, reason, refType, refId) index is what prevents double awards.
 */
export async function awardXp(opts: {
  userId: string
  reason: XpReason
  refType?: string
  refId?: string
  /** Override for reasons with variable rewards (quests). */
  amount?: number
}): Promise<XpAward | null> {
  const amount = opts.amount ?? XP_AMOUNTS[opts.reason]
  if (amount <= 0) return null
  try {
    const cap = XP_DAILY_EVENT_CAPS[opts.reason]
    if (cap !== undefined) {
      const todayCount = await prisma.xpEvent.count({
        where: { userId: opts.userId, reason: opts.reason, createdAt: { gte: startOfUtcDay() } },
      })
      if (todayCount >= cap) return null
    }

    return await prisma.$transaction(async (tx) => {
      await tx.xpEvent.create({
        data: {
          userId: opts.userId,
          amount,
          reason: opts.reason,
          refType: opts.refType ?? null,
          refId: opts.refId ?? null,
        },
      })
      const stats = await tx.userStats.upsert({
        where: { userId: opts.userId },
        create: { userId: opts.userId, xpTotal: amount, level: levelForXp(amount) },
        update: { xpTotal: { increment: amount } },
      })
      const level = levelForXp(stats.xpTotal)
      if (level !== stats.level) {
        await tx.userStats.update({ where: { userId: opts.userId }, data: { level } })
      }
      return { awarded: amount, xpTotal: stats.xpTotal, level, leveledUp: level > stats.level }
    })
  } catch (e) {
    if (hasPrismaCode(e, 'P2002')) return null // already awarded for this ref
    logger.error({ err: e, userId: opts.userId, reason: opts.reason }, 'XP award failed')
    return null
  }
}
