import type { UserQuest } from '@prisma/client'
import { prisma } from './db'
import { logger } from './logger'
import { awardXp } from './xp-service'

export type QuestCriteria =
  | 'BITES_LOGGED'
  | 'PLACE_BITES_LOGGED'
  | 'REVIEWS_POSTED'
  | 'LIKES_GIVEN'
  | 'COMMENTS_POSTED'

const DAILY_QUEST_COUNT = 3
// "Log a meal" anchors every daily set — it IS the habit.
const ALWAYS_INCLUDED_KEY = 'daily-bite'
const FALLBACK_TIMEZONE = 'Europe/Amsterdam'

/** Today's local calendar day for the user, as a UTC-midnight Date (matches @db.Date). */
function localQuestDate(timezone: string | null): Date {
  let tz = timezone ?? FALLBACK_TIMEZONE
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
  } catch {
    tz = FALLBACK_TIMEZONE
  }
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
  return new Date(`${dateStr}T00:00:00.000Z`)
}

/** Small deterministic hash so the same user gets the same quests all day. */
function hashCode(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/** Returns today's quests, assigning a fresh set on the first read of the day. */
export async function getOrAssignDailyQuests(userId: string): Promise<UserQuest[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } })
  const assignedDate = localQuestDate(user?.timezone ?? null)

  const existing = await prisma.userQuest.findMany({
    where: { userId, assignedDate },
    orderBy: { createdAt: 'asc' },
  })
  if (existing.length > 0) return existing

  const templates = await prisma.questTemplate.findMany({ where: { active: true } })
  if (templates.length === 0) return []

  const anchor = templates.find((t) => t.key === ALWAYS_INCLUDED_KEY)
  const pool = templates
    .filter((t) => t.key !== ALWAYS_INCLUDED_KEY)
    .sort((a, b) => a.key.localeCompare(b.key))

  const seed = hashCode(`${userId}:${assignedDate.toISOString().slice(0, 10)}`)
  const rotating: typeof pool = []
  for (let i = 0; rotating.length < DAILY_QUEST_COUNT - (anchor ? 1 : 0) && i < pool.length; i++) {
    rotating.push(pool[(seed + i * 2) % pool.length])
    // Deduplicate in case the stride wrapped onto the same template.
    if (rotating.length >= 2 && rotating.at(-1)!.id === rotating.at(-2)!.id) rotating.pop()
  }

  const selection = [...(anchor ? [anchor] : []), ...rotating].slice(0, DAILY_QUEST_COUNT)

  // skipDuplicates makes concurrent first-reads race-safe (unique on
  // user+template+date); both racers end up returning the same set.
  await prisma.userQuest.createMany({
    data: selection.map((t) => ({
      userId,
      templateId: t.id,
      assignedDate,
      criteriaType: t.criteriaType,
      title: t.title,
      description: t.description,
      target: t.target,
      rewardXp: t.rewardXp,
    })),
    skipDuplicates: true,
  })

  return prisma.userQuest.findMany({
    where: { userId, assignedDate },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Advances today's quests matching the criteria. Completion is race-safe:
 * the guarded updateMany decides the single winner, and awardXp's unique
 * (user, reason, ref) constraint backstops it. Never throws — quest progress
 * must not break the action that triggered it.
 */
export async function bumpQuestProgress(
  userId: string,
  criteria: QuestCriteria,
  amount = 1,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } })
    const assignedDate = localQuestDate(user?.timezone ?? null)

    const updated = await prisma.userQuest.updateMany({
      where: { userId, assignedDate, criteriaType: criteria, completedAt: null },
      data: { progress: { increment: amount } },
    })
    if (updated.count === 0) return

    const candidates = await prisma.userQuest.findMany({
      where: { userId, assignedDate, criteriaType: criteria, completedAt: null },
    })
    for (const quest of candidates) {
      if (quest.progress < quest.target) continue
      const won = await prisma.userQuest.updateMany({
        where: { id: quest.id, completedAt: null },
        data: { completedAt: new Date() },
      })
      if (won.count === 1) {
        await awardXp({
          userId,
          reason: 'QUEST_COMPLETED',
          refType: 'quest',
          refId: quest.id,
          amount: quest.rewardXp,
        })
      }
    }
  } catch (err) {
    logger.error({ err, userId, criteria }, 'Quest progress update failed')
  }
}
