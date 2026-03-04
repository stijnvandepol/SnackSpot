import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, err, requireAuth, serverError, isResponse } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: {
        id: true,
        email: true,
        username: true,
        avatarKey: true,
        role: true,
        createdAt: true,
        _count: { select: { reviews: true, favorites: true } },
      },
    })
    if (!user) return err('User not found', 404)
    return ok(user)
  } catch (e) {
    return serverError('me', e)
  }
}
