import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, parseQuery, requireAuth, serverError, isResponse } from '@/lib/api-helpers'

const SearchUsersQuerySchema = z.object({
  q: z.string().min(1).max(50),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const query = parseQuery(req, SearchUsersQuerySchema)
  if (isResponse(query)) return query

  try {
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

    return ok(users)
  } catch (e) {
    return serverError('users/search', e)
  }
}
