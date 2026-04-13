import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, err, parseQuery, requireAuth, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'
import { buildCacheKey, getCachedJson, setCachedJson } from '@/lib/cache'

const SearchUsersQuerySchema = z.object({
  q: z.string().min(1).max(50),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const rl = await rateLimitUser(auth.sub, 'users-search', 30, 60)
  if (!rl.allowed) return err('Too many requests', 429)

  const query = parseQuery(req, SearchUsersQuerySchema)
  if (isResponse(query)) return query

  try {
    const cacheKey = buildCacheKey('users-search', `${query.q.toLowerCase()}:${query.limit}`)
    const cached = await getCachedJson<Array<{ id: string; username: string; avatarKey: string | null }>>(cacheKey)
    if (cached) return ok(cached)

    const users = await prisma.user.findMany({
      where: {
        username: {
          contains: query.q,
          mode: 'insensitive',
        },
        bannedAt: null,
      },
      take: query.limit,
      select: {
        id: true,
        username: true,
        avatarKey: true,
      },
      orderBy: {
        username: 'asc',
      },
    })

    await setCachedJson(cacheKey, users, 30)

    return ok(users)
  } catch (e) {
    return serverError('users/search', e)
  }
}
