import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, requireAuth, serverError, isResponse } from '@/lib/api-helpers'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const { id } = await params

  try {
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!notification || notification.userId !== auth.sub) {
      return new Response(JSON.stringify({ error: 'Notification not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
      select: {
        id: true,
        isRead: true,
      },
    })

    return ok({ data: updated })
  } catch (e) {
    return serverError('notification/read', e)
  }
}
