import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/comments/flagged - List flagged comments
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin

  try {
    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '50'))
    const status = url.searchParams.get('status') || 'PENDING'

    const where = ['PENDING', 'APPROVED', 'DELETED'].includes(status)
      ? { status }
      : {}

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
  } catch {
    return NextResponse.json({ error: 'Error fetching flagged comments' }, { status: 500 })
  }
}
