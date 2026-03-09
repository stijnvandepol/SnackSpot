import { NextRequest, NextResponse } from 'next/server'
import { LoginSchema } from '@snackspot/shared'
import { db } from '@/lib/db'
import argon2 from 'argon2'
import { buildSetAdminCookie, signAdminAccessToken } from '@/lib/auth'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  const rl = rateLimit(`admin-login:${ip}`, 5, 15 * 60)
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

    // Find user
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

    // Generate JWT token
    const accessToken = signAdminAccessToken(
      {
        sub: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    )

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    })
    response.headers.set('Set-Cookie', buildSetAdminCookie(accessToken))
    return response
  } catch (error) {
    return NextResponse.json(
      { error: 'Er is een fout opgetreden' },
      { status: 500 }
    )
  }
}
