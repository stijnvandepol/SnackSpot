import { prisma } from '@/lib/db'
import { ok, serverError, withPublicCache } from '@/lib/api-helpers'

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/
const MAX_USERNAMES_PER_REQUEST = 50

export async function GET(req: Request) {
  try {
    const rawUsernames = new URL(req.url).searchParams.get('usernames') ?? ''
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
