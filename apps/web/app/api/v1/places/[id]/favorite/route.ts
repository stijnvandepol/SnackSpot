import { type NextRequest } from 'next/server'
import { err, isResponse, ok, requireAuth, serverError, withNoStore } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'
import { isFavorite, removeFavorite, saveFavorite } from '@/lib/favorite-service'
import { recordEvent } from '@/lib/analytics-store'

type Params = { params: Promise<{ id: string }> }

/** Whether the signed-in user has saved this place. */
export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth
  const { id } = await params
  try {
    return withNoStore(ok({ saved: await isFavorite(auth.sub, id) }))
  } catch (e) {
    return serverError('favorite GET', e)
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const rl = await rateLimitUser(auth.sub, 'favorite_toggle', 60, 3600)
  if (!rl.allowed) return err('Te veel wijzigingen achter elkaar. Probeer het zo opnieuw.', 429)

  const { id } = await params
  try {
    const result = await saveFavorite(auth.sub, id)
    if (!result.ok) return err(result.error, result.status)
    await recordEvent('place_saved')
    return ok({ saved: true })
  } catch (e) {
    return serverError('favorite POST', e)
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const rl = await rateLimitUser(auth.sub, 'favorite_toggle', 60, 3600)
  if (!rl.allowed) return err('Te veel wijzigingen achter elkaar. Probeer het zo opnieuw.', 429)

  const { id } = await params
  try {
    await removeFavorite(auth.sub, id)
    return ok({ saved: false })
  } catch (e) {
    return serverError('favorite DELETE', e)
  }
}
