import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, err, requireAuth, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  try {
    // updateMany over all unread rows is comparatively expensive; once per
    // bell-open is the legitimate pattern, so 10/min is already generous.
    const rl = await rateLimitUser(auth.sub, 'notifications_read_all', 10, 60)
    if (!rl.allowed) return err('Too many requests', 429)

    const result = await prisma.notification.updateMany({
      where: {
        userId: auth.sub,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    })

    return ok({ count: result.count })
  } catch (e) {
    return serverError('notifications/read-all', e)
  }
}
