import { type NextRequest } from 'next/server'
import { ok, requireAuth, serverError, isResponse, withNoStore } from '@/lib/api-helpers'
import { getOrAssignDailyQuests } from '@/lib/quest-service'

// GET /api/v1/me/quests — today's daily quests; assigns a set on first read.
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  try {
    const quests = await getOrAssignDailyQuests(auth.sub)
    return withNoStore(
      ok({
        data: quests.map((q) => ({
          id: q.id,
          title: q.title,
          description: q.description,
          progress: q.progress,
          target: q.target,
          rewardXp: q.rewardXp,
          completed: q.completedAt !== null,
        })),
      }),
    )
  } catch (e) {
    return serverError('me/quests GET', e)
  }
}
