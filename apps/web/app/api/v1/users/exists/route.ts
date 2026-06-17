import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, parseQuery, isResponse, serverError, withPublicCache } from '@/lib/api-helpers'

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/
const MAX_USERNAMES_PER_REQUEST = 50

// Comma-separated list; individual usernames are further validated against
// USERNAME_PATTERN below. Cap the raw length to bound work per request.
const ExistsQuerySchema = z.object({
  usernames: z.string().max(2000).optional().default(''),
})

export async function GET(req: NextRequest) {
  try {
    const query = parseQuery(req, ExistsQuerySchema)
    if (isResponse(query)) return query
    const rawUsernames = query.usernames
    const usernames = [
      ...new Set(
        rawUsernames
          .split(',')
          .map((part: string) => part.trim())
          .filter((username: string) => USERNAME_PATTERN.test(username)),
      ),
    ].slice(0, MAX_USERNAMES_PER_REQUEST)

    if (usernames.length === 0) {
      return await withPublicCache(ok({ existing: [] as string[] }), 30, 120)
    }

    const users = await prisma.user.findMany({
      where: {
        bannedAt: null,
        OR: usernames.map((username) => ({
          username: { equals: username, mode: 'insensitive' },
        })),
      },
      select: { username: true },
    })

    return await withPublicCache(
      ok({
        existing: users.map((user: { username: string }) => user.username.toLowerCase()),
      }),
      30,
      120,
    )
  } catch (e) {
    return serverError('users/exists', e)
  }
}
