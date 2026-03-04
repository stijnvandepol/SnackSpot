import { type NextRequest } from 'next/server'
import { LoginSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import {
  verifyPassword,
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
  buildSetCookie,
} from '@/lib/auth'
import { ok, err, parseBody, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitIP, getClientIP } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Rate limit: 10 login attempts per 15 min per IP
  const ip = getClientIP(req)
  const rl = await rateLimitIP(ip, 'login', 10, 900)
  if (!rl.allowed) {
    return err('Too many login attempts – try again later', 429)
  }

  const body = await parseBody(req, LoginSchema)
  if (isResponse(body)) return body

  try {
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, email: true, username: true, passwordHash: true, role: true, bannedAt: true, displayName: true },
    })

    // Constant-time compare (same timing whether user exists or not)
    const passwordOk = user ? await verifyPassword(user.passwordHash, body.password) : false

    if (!user || !passwordOk) {
      return err('Invalid email or password', 401)
    }

    if (user.bannedAt) {
      return err('Account banned', 403)
    }

    const accessToken = signAccessToken({ sub: user.id, email: user.email, username: user.username, role: user.role })
    const rawRefresh = generateRefreshToken()
    const expiresAt = refreshTokenExpiresAt()

    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: hashRefreshToken(rawRefresh), expiresAt },
    })

    const { passwordHash: _, ...safeUser } = user
    const response = ok({ user: safeUser, access_token: accessToken })
    response.headers.set('Set-Cookie', buildSetCookie(rawRefresh, expiresAt))
    return response
  } catch (e) {
    return serverError('login', e)
  }
}
