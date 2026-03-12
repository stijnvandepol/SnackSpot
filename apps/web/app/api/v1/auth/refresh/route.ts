import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
  buildSetCookie,
  buildClearCookie,
  REFRESH_COOKIE,
} from '@/lib/auth'
import { ok, err, serverError, requireSameOrigin, withNoStore } from '@/lib/api-helpers'

function getRefreshToken(req: NextRequest): string | null {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${REFRESH_COOKIE}=([^;]+)`))
  return match?.[1] ?? null
}

export async function POST(req: NextRequest) {
  const sameOrigin = requireSameOrigin(req)
  if (sameOrigin) return sameOrigin

  const rawToken = getRefreshToken(req)
  if (!rawToken) return err('No refresh token', 401)

  try {
    const tokenHash = hashRefreshToken(rawToken)
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, username: true, role: true, bannedAt: true } } },
    })

    if (!stored) {
      // Can happen during refresh-token rotation races (multi-tab / concurrent requests).
      // Avoid clearing cookie here to prevent accidental logout when a newer cookie exists.
      return err('Refresh token invalid', 401)
    }

    // Theft detection: token was already rotated but is being presented again.
    // A legitimate client only ever holds the latest token in a family, so a
    // previously-used token reappearing means two parties hold the same secret.
    // Invalidate the entire family to force both parties to re-authenticate.
    if (stored.usedAt !== null) {
      const usedAgoMs = Date.now() - stored.usedAt.getTime()
      if (usedAgoMs > 5 * 60 * 1000) {
        // Used more than 5 minutes ago — strong theft signal, nuke the family.
        await prisma.refreshToken.deleteMany({
          where: { family: stored.family },
        })
        const res = err('Session invalidated – please log in again', 401)
        res.headers.set('Set-Cookie', buildClearCookie())
        return res
      }
      // Used very recently — likely a concurrent retry, not theft.
      return err('Refresh token already used', 401)
    }

    if (stored.expiresAt < new Date()) {
      const res = err('Refresh token expired', 401)
      res.headers.set('Set-Cookie', buildClearCookie())
      return res
    }

    if (stored.user.bannedAt) {
      await prisma.refreshToken.deleteMany({ where: { family: stored.family } })
      const res = err('Account banned', 403)
      res.headers.set('Set-Cookie', buildClearCookie())
      return res
    }

    // Rotate: mark old token as used (kept for theft detection window), issue new one.
    await prisma.refreshToken.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    })

    const newRaw = generateRefreshToken()
    const expiresAt = refreshTokenExpiresAt()
    await prisma.refreshToken.create({
      data: { userId: stored.user.id, tokenHash: hashRefreshToken(newRaw), family: stored.family, expiresAt },
    })

    const accessToken = signAccessToken({
      sub: stored.user.id,
      email: stored.user.email,
      username: stored.user.username,
      role: stored.user.role,
    })

    const response = withNoStore(ok({ access_token: accessToken }))
    response.headers.set('Set-Cookie', buildSetCookie(newRaw, expiresAt))
    return response
  } catch (e) {
    return serverError('refresh', e)
  }
}
