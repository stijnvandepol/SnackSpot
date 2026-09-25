import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { getDailyCounts, totalsByEvent } from '@/lib/analytics-store'
import { isResponse, ok, parseQuery, requireRole, serverError, withNoStore } from '@/lib/api-helpers'

const QuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(28),
})

/** Funnel counts for the admin dashboard: per day, plus totals per event over the window. */
export async function GET(req: NextRequest) {
  const auth = requireRole(req, 'ADMIN')
  if (isResponse(auth)) return auth

  const query = parseQuery(req, QuerySchema)
  if (isResponse(query)) return query

  try {
    const days = await getDailyCounts(query.days)
    return withNoStore(ok({ days, totals: totalsByEvent(days) }))
  } catch (e) {
    return serverError('admin analytics GET', e)
  }
}
