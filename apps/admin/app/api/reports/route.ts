import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100
const VALID_REPORT_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'] as const
const VALID_TARGET_TYPES = ['REVIEW', 'PHOTO', 'USER'] as const

// GET /api/reports - List all reports
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin

  try {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || String(DEFAULT_PAGE))
    const limit = Math.min(parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT)), MAX_LIMIT)
    const status = url.searchParams.get('status') || 'OPEN'
    const targetType = url.searchParams.get('targetType') || ''

    const where: Prisma.ReportWhereInput = {}

    if (status && (VALID_REPORT_STATUSES as readonly string[]).includes(status)) {
      where.status = status as Prisma.ReportWhereInput['status']
    }

    if (targetType && (VALID_TARGET_TYPES as readonly string[]).includes(targetType)) {
      where.targetType = targetType as Prisma.ReportWhereInput['targetType']
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
              uploaderId: true,
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
  } catch {
    return NextResponse.json(
      { error: 'Error fetching reports' },
      { status: 500 }
    )
  }
}
