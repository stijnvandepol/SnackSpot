import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { LoginSchema } from '@snackspot/shared'
import { db } from '@/lib/db'
import argon2 from 'argon2'
import {
  buildSetAdminCookie,
  buildSetRefreshCookie,
  signAdminAccessToken,
  generateRefreshToken,
  storeRefreshToken,
} from '@/lib/auth'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

const LOGIN_RATE_LIMIT = 5
const LOGIN_RATE_WINDOW_SECONDS = 15 * 60

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  const rl = await rateLimit(`admin-login:${ip}`, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_SECONDS)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Te veel inlogpogingen. Probeer het later opnieuw.' },
      { status: 429 }
    )
  }

  try {
    const body = await req.json().catch(() => null)
    const parsed = LoginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige request body' },
        { status: 422 }
      )
    }
    const { email, password } = parsed.data

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        passwordHash: true,
      },
    })

    const passwordOk = user
      ? await argon2.verify(user.passwordHash, password)
      : await argon2.hash(password).then(() => false)

    if (!user || user.role !== 'ADMIN' || !passwordOk) {
      return NextResponse.json(
        { error: 'Ongeldige inloggegevens' },
        { status: 401 }
      )
    }

    const accessToken = signAdminAccessToken({
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    })

    // Issue refresh token for rotation
    const rawRefreshToken = generateRefreshToken()
    const family = crypto.randomUUID()
    await storeRefreshToken(user.id, rawRefreshToken, family)

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    })
    response.headers.append('Set-Cookie', buildSetAdminCookie(accessToken))
    response.headers.append('Set-Cookie', buildSetRefreshCookie(rawRefreshToken))
    return response
  } catch {
    return NextResponse.json(
      { error: 'Er is een fout opgetreden' },
      { status: 500 }
    )
  }
}
