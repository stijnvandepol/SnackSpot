import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { isResponse, ok, parseQuery, requireAuth, serverError, withNoStore } from '@/lib/api-helpers'
import { listFavorites } from '@/lib/favorite-service'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

/** The signed-in user's saved places, newest first. Private: never exposed on /u/[username]. */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const query = parseQuery(req, QuerySchema)
  if (isResponse(query)) return query

  try {
    return withNoStore(ok({ data: await listFavorites(auth.sub, query.limit) }))
  } catch (e) {
    return serverError('me favorites GET', e)
  }
}
