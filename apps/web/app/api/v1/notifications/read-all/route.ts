import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, requireAuth, serverError, isResponse } from '@/lib/api-helpers'

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId: auth.sub,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    })

    return ok({ data: { count: result.count } })
  } catch (e) {
    return serverError('notifications/read-all', e)
  }
}
