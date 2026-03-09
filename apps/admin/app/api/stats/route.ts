import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin

  try {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [
      totalUsers,
      totalPlaces,
      totalReviews,
      recentUsers,
      recentReviews,
      placesWithoutReviews,
      openReports,
    ] = await Promise.all([
      db.user.count(),
      db.place.count(),
      db.review.count({ where: { status: { not: 'DELETED' } } }),
      db.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      db.review.count({
        where: {
          createdAt: { gte: sevenDaysAgo },
          status: { not: 'DELETED' },
        },
      }),
      db.place.count({
        where: {
          reviews: {
            none: {
              status: { not: 'DELETED' },
            },
          },
        },
      }),
      db.report.count({
        where: {
          status: 'OPEN',
        },
      }),
    ])

    return NextResponse.json({
      totalUsers,
      totalPlaces,
      totalReviews,
      recentUsers,
      recentReviews,
      placesWithoutReviews,
      openReports,
    })
  } catch {
    return NextResponse.json({ error: 'Er is een fout opgetreden' }, { status: 500 })
  }
}
