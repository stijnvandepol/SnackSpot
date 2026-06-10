import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseQuery, serverError, isResponse } from '@/lib/api-helpers'

// The dashboard sends empty strings for unset filters (e.g. `targetType=`);
// treat those as absent so they fall through to the default/no-filter case.
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v)

const ListReportsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.preprocess(emptyToUndefined, z.enum(['OPEN', 'RESOLVED', 'DISMISSED']).default('OPEN')),
  targetType: z.preprocess(emptyToUndefined, z.enum(['REVIEW', 'PHOTO', 'USER']).optional()),
})

// GET /api/reports - List all reports
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin

  const query = parseQuery(req, ListReportsQuery)
  if (isResponse(query)) return query
  const { page, limit, status, targetType } = query

  try {
    const where: Prisma.ReportWhereInput = { status }

    if (targetType) {
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
  } catch (e) {
    return serverError('reports GET', e)
  }
}
