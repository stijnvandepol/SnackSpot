import { type NextRequest } from 'next/server'
import { ok, requireAuth, serverError, isResponse, withNoStore } from '@/lib/api-helpers'
import { getUserStats } from '@/lib/user-stats'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  try {
    return withNoStore(ok(await getUserStats(auth.sub)))
  } catch (e) {
    return serverError('me/stats GET', e)
  }
}
