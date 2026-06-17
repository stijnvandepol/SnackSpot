import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, err, requireAuth, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const { id } = await params

  try {
    // Generous (a fast reader marks dozens per minute) but caps update-spam.
    const rl = await rateLimitUser(auth.sub, 'notification_read', 120, 60)
    if (!rl.allowed) return err('Too many requests', 429)

    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!notification || notification.userId !== auth.sub) {
      return err('Notification not found', 404)
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
      select: {
        id: true,
        isRead: true,
      },
    })

    return ok(updated)
  } catch (e) {
    return serverError('notification/read', e)
  }
}
