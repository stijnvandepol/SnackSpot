import { type NextRequest } from 'next/server'
import { RegisterSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import {
  hashPassword,
  signAccessToken,
  generateRefreshToken,
  generateTokenFamily,
  hashRefreshToken,
  refreshTokenExpiresAt,
  buildSetCookie,
} from '@/lib/auth'
import { created, err, parseBody, serverError, isResponse, requireSameOrigin, withNoStore } from '@/lib/api-helpers'
import { rateLimitIP, getClientIP } from '@/lib/rate-limit'
import { sendWelcomeEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const sameOrigin = requireSameOrigin(req)
  if (sameOrigin) return sameOrigin

  // Rate limit: 5 registrations per hour per IP
  const ip = getClientIP(req)
  const rl = await rateLimitIP(ip, 'register', 5, 3600)
  if (!rl.allowed) {
    return err('Too many registration attempts – try again later', 429)
  }

  const body = await parseBody(req, RegisterSchema)
  if (isResponse(body)) return body

  try {
    const conflict = await prisma.user.findFirst({
      where: { OR: [{ email: body.email }, { username: body.username }] },
      select: { email: true, username: true },
    })
    if (conflict) {
      return err('Email or username already taken', 409)
    }

    const passwordHash = await hashPassword(body.password)

    const user = await prisma.user.create({
      data: {
        email: body.email,
        username: body.username,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        username: true,
        bio: true,
        avatarKey: true,
        usernameChangedAt: true,
        role: true,
        createdAt: true,
      },
    })

    const accessToken = signAccessToken({ sub: user.id, email: user.email, username: user.username, role: user.role })
    const rawRefresh = generateRefreshToken()
    const expiresAt = refreshTokenExpiresAt()

    await prisma.$transaction([
      prisma.refreshToken.create({
        data: { userId: user.id, tokenHash: hashRefreshToken(rawRefresh), family: generateTokenFamily(), expiresAt },
      }),
    ])

    try {
      await sendWelcomeEmail(user.email, user.username)
    } catch (e: unknown) {
      logger.warn({ err: e }, 'register: welcome email failed to send')
    }

    const response = withNoStore(created({ user, access_token: accessToken }))
    response.headers.set('Set-Cookie', buildSetCookie(rawRefresh, expiresAt))
    return response
  } catch (e) {
    return serverError('register', e)
  }
}
