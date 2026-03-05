import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { hashRefreshToken, buildClearCookie, REFRESH_COOKIE } from '@/lib/auth'
import { ok, serverError, requireSameOrigin, withNoStore } from '@/lib/api-helpers'

export async function POST(req: NextRequest) {
  const sameOrigin = requireSameOrigin(req)
  if (sameOrigin) return sameOrigin

  const cookieHeader = req.headers.get('cookie') ?? ''
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${REFRESH_COOKIE}=([^;]+)`))
  const rawToken = match?.[1]

  try {
    if (rawToken) {
      await prisma.refreshToken
        .delete({ where: { tokenHash: hashRefreshToken(rawToken) } })
        .catch(() => undefined) // Token may already be gone – that's fine
    }
    const res = withNoStore(ok({ message: 'Logged out' }))
    res.headers.set('Set-Cookie', buildClearCookie())
    return res
  } catch (e) {
    return serverError('logout', e)
  }
}
