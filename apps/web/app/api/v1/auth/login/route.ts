import { type NextRequest } from 'next/server'
import { LoginSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import {
  verifyPassword,
  hashPassword,
  signAccessToken,
  generateRefreshToken,
  generateTokenFamily,
  hashRefreshToken,
  refreshTokenExpiresAt,
  buildSetCookie,
} from '@/lib/auth'
import { ok, err, parseBody, serverError, isResponse, requireSameOrigin, withNoStore } from '@/lib/api-helpers'
import {
  rateLimitIP,
  rateLimit,
  getClientIP,
  incrementLoginFailures,
  resetLoginFailures,
  getLoginFailureCount,
} from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'

const CAPTCHA_THRESHOLD = 3

export async function POST(req: NextRequest) {
  const sameOrigin = requireSameOrigin(req)
  if (sameOrigin) return sameOrigin

  // Rate limit: 10 login attempts per 15 min per IP
  const ip = getClientIP(req)
  const rl = await rateLimitIP(ip, 'login', 10, 900)
  if (!rl.allowed) {
    return err('Too many login attempts – try again later', 429)
  }

  const body = await parseBody(req, LoginSchema)
  if (isResponse(body)) return body

  // Rate limit: 5 login attempts per 10 min per account (catches proxy-rotating attackers)
  const accountRl = await rateLimit(`rl:account:login:${body.email.toLowerCase()}`, 5, 600)
  if (!accountRl.allowed) {
    return err('Too many login attempts – try again later', 429)
  }

  // CAPTCHA: required once either the IP or the account reaches 3 failures.
  // The token is single-use — Cloudflare returns timeout-or-duplicate on replay.
  const failures = await getLoginFailureCount(ip, body.email)
  if (failures.ip >= CAPTCHA_THRESHOLD || failures.email >= CAPTCHA_THRESHOLD) {
    if (!body.captchaToken) {
      return Response.json({ error: 'captcha_required', captchaRequired: true }, { status: 400 })
    }
    const tokenValid = await verifyTurnstileToken(body.captchaToken, ip)
    if (!tokenValid) {
      return Response.json({ error: 'captcha_required', captchaRequired: true }, { status: 400 })
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        email: true,
        username: true,
        bio: true,
        avatarKey: true,
        usernameChangedAt: true,
        passwordHash: true,
        role: true,
        bannedAt: true,
      },
    })

    // Make username enumeration harder by spending similar CPU even when user does not exist.
    const passwordOk = user
      ? await verifyPassword(user.passwordHash, body.password)
      : await hashPassword(body.password).then(() => false)

    if (!user || !passwordOk) {
      await incrementLoginFailures(ip, body.email)
      return err('Invalid email or password', 401)
    }

    if (user.bannedAt) {
      return err('Account banned', 403)
    }

    await resetLoginFailures(ip, body.email)

    const accessToken = signAccessToken({ sub: user.id, email: user.email, username: user.username, role: user.role })
    const rawRefresh = generateRefreshToken()
    const expiresAt = refreshTokenExpiresAt()

    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: hashRefreshToken(rawRefresh), family: generateTokenFamily(), expiresAt },
    })

    const { passwordHash: _, ...safeUser } = user
    const response = withNoStore(ok({ user: safeUser, access_token: accessToken }))
    response.headers.set('Set-Cookie', buildSetCookie(rawRefresh, expiresAt))
    return response
  } catch (e) {
    return serverError('login', e)
  }
}
