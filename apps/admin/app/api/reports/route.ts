import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/reports - List all reports
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    await requireAdmin(authHeader)

    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const status = url.searchParams.get('status') || 'OPEN'
    const targetType = url.searchParams.get('targetType') || ''

    const where: any = {}
    
    if (status && ['OPEN', 'RESOLVED', 'DISMISSED'].includes(status)) {
      where.status = status
    }

    if (targetType && ['REVIEW', 'PHOTO', 'USER'].includes(targetType)) {
      where.targetType = targetType
    }

    const [reports, total] = await Promise.all([
      db.report.findMany({
        where,
        select: {
          id: true,
          targetType: true,
          reason: true,
          status: true,
          createdAt: true,
          reporter: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          review: {
            select: {
              id: true,
              text: true,
              status: true,
              rating: true,
              user: {
                select: {
                  id: true,
                  username: true,
                },
              },
              place: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          photo: {
            select: {
              id: true,
              moderationStatus: true,
              uploadedById: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.report.count({ where }),
    ])

    return NextResponse.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error fetching reports' },
      { status: 500 }
    )
  }
}
