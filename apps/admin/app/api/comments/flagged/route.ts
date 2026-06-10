import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseQuery, serverError, isResponse } from '@/lib/api-helpers'

const ListFlaggedQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  status: z.enum(['PENDING', 'APPROVED', 'DELETED']).default('PENDING'),
})

// GET /api/comments/flagged - List flagged comments
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin

  const query = parseQuery(req, ListFlaggedQuery)
  if (isResponse(query)) return query
  const { page, limit, status } = query

  try {
    const where = { status }

    const [flagged, total] = await Promise.all([
      db.flaggedComment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          matchedWord: true,
          status: true,
          createdAt: true,
          comment: {
            select: {
              id: true,
              text: true,
              createdAt: true,
              user: { select: { id: true, username: true, email: true } },
              review: {
                select: {
                  id: true,
                  place: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
      db.flaggedComment.count({ where }),
    ])

    return NextResponse.json({ flagged, pagination: { page, limit, total } })
  } catch (e) {
    return serverError('flagged GET', e)
  }
}
