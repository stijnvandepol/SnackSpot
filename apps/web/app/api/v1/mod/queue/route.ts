import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, err, parseQuery, requireRole, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'
import { ReportStatus } from '@prisma/client'

const QueueQuerySchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']).default('OPEN'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  // Cursor is an ISO 8601 timestamp produced by the previous page response
  cursor: z.string().datetime({ offset: true }).optional(),
})

export async function GET(req: NextRequest) {
  const auth = requireRole(req, 'MODERATOR')
  if (isResponse(auth)) return auth

  // Rate limit: 120 requests per minute per moderator
  const rl = await rateLimitUser(auth.sub, 'mod_queue', 120, 60)
  if (!rl.allowed) return err('Too many requests', 429)

  const query = parseQuery(req, QueueQuerySchema)
  if (isResponse(query)) return query

  try {
    const reports = await prisma.report.findMany({
      where: {
        status: query.status as ReportStatus,
        ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit + 1,
      select: {
        id: true,
        targetType: true,
        reason: true,
        status: true,
        createdAt: true,
        reporter: { select: { id: true, username: true } },
        review: {
          select: {
            id: true,
            text: true,
            status: true,
            user: { select: { id: true, username: true } },
          },
        },
        photo: { select: { id: true, variants: true, moderationStatus: true } },
      },
    })

    const hasMore = reports.length > query.limit
    const items = hasMore ? reports.slice(0, query.limit) : reports
    const nextCursor = hasMore ? items.at(-1)!.createdAt.toISOString() : null

    return ok({ data: items, pagination: { nextCursor, hasMore } })
  } catch (e) {
    return serverError('mod/queue', e)
  }
}
