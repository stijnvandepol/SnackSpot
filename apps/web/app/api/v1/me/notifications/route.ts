import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, parseQuery, requireAuth, serverError, isResponse, withNoStore } from '@/lib/api-helpers'

const NotificationsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z.coerce.boolean().optional().default(false),
})

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const query = parseQuery(req, NotificationsQuerySchema)
  if (isResponse(query)) return query

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId: auth.sub,
          ...(query.unreadOnly ? { isRead: false } : {}),
          ...(query.cursor ? { createdAt: { lt: new Date(decodeURIComponent(query.cursor)) } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit + 1,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          link: true,
          isRead: true,
          createdAt: true,
          actor: {
            select: {
              id: true,
              username: true,
              avatarKey: true,
            },
          },
        },
      }),
      prisma.notification.count({
        where: { userId: auth.sub, isRead: false },
      }),
    ])

    const hasMore = notifications.length > query.limit
    const items = hasMore ? notifications.slice(0, query.limit) : notifications
    const nextCursor = hasMore ? encodeURIComponent(items.at(-1)!.createdAt.toISOString()) : null

    return withNoStore(ok({ data: items, pagination: { nextCursor, hasMore }, unreadCount }))
  } catch (e) {
    return serverError('me/notifications', e)
  }
}
