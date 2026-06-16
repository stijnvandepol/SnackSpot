import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { issueSession } from '@/lib/session'
import { getGoogleProvider, validateGoogleCallback } from '@/lib/oauth/google'
import { decideAccountAction } from '@/lib/oauth/account-resolution'
import { generateUniqueUsername } from '@/lib/username'
import { OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from '../route'

function readCookie(req: NextRequest, name: string): string | null {
  const header = req.headers.get('cookie') ?? ''
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match?.[1] ?? null
}

function clearTempCookie(name: string): string {
  return `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`
}

function redirectToLogin(error: string): Response {
  const headers = new Headers()
  headers.set('Location', `${env.NEXT_PUBLIC_APP_URL}/auth/login?error=${error}`)
  headers.append('Set-Cookie', clearTempCookie(OAUTH_STATE_COOKIE))
  headers.append('Set-Cookie', clearTempCookie(OAUTH_VERIFIER_COOKIE))
  return new Response(null, { status: 302, headers })
}

export async function GET(req: NextRequest) {
  const google = getGoogleProvider()
  if (!google) return redirectToLogin('google_unavailable')

  const url = req.nextUrl
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const storedState = readCookie(req, OAUTH_STATE_COOKIE)
  const codeVerifier = readCookie(req, OAUTH_VERIFIER_COOKIE)

  // CSRF guard: the state in the URL must match the state we set before redirecting.
  if (!code || !state || !storedState || state !== storedState || !codeVerifier) {
    return redirectToLogin('invalid_state')
  }

  try {
    const claims = await validateGoogleCallback(google, code, codeVerifier)

    const [linked, byEmail] = await Promise.all([
      prisma.account.findUnique({
        where: { provider_providerAccountId: { provider: 'google', providerAccountId: claims.sub } },
        select: { userId: true, user: { select: { bannedAt: true } } },
      }),
      prisma.user.findUnique({
        where: { email: claims.email },
        select: { id: true, bannedAt: true },
      }),
    ])

    const action = decideAccountAction(claims, {
      linkedUserId: linked?.userId ?? null,
      userIdByEmail: byEmail?.id ?? null,
      bannedByEmail: (linked?.user.bannedAt ?? byEmail?.bannedAt ?? null) !== null,
    })

    if (action.type === 'reject') return redirectToLogin(action.reason)

    let sessionUser: { id: string; email: string; username: string; role: 'USER' | 'MODERATOR' | 'ADMIN' }

    if (action.type === 'create') {
      const username = await generateUniqueUsername(claims.name ?? claims.email.split('@')[0], async (u) => {
        const hit = await prisma.user.findUnique({ where: { username: u }, select: { id: true } })
        return hit !== null
      })
      const user = await prisma.user.create({
        data: {
          email: claims.email,
          username,
          passwordHash: null,
          emailVerifiedAt: new Date(),
          accounts: { create: { provider: 'google', providerAccountId: claims.sub } },
        },
        select: { id: true, email: true, username: true, role: true },
      })
      sessionUser = user
    } else {
      // login or link — both resolve to an existing user id.
      if (action.type === 'link') {
        await prisma.account.create({
          data: { userId: action.userId, provider: 'google', providerAccountId: claims.sub },
        })
      }
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: action.userId },
        select: { id: true, email: true, username: true, role: true },
      })
      sessionUser = user
    }

    const { setCookie } = await issueSession(sessionUser)
    const headers = new Headers()
    headers.set('Location', `${env.NEXT_PUBLIC_APP_URL}/`)
    headers.append('Set-Cookie', setCookie)
    headers.append('Set-Cookie', clearTempCookie(OAUTH_STATE_COOKIE))
    headers.append('Set-Cookie', clearTempCookie(OAUTH_VERIFIER_COOKIE))
    return new Response(null, { status: 302, headers })
  } catch (e) {
    logger.error({ err: e, context: 'google-callback' }, 'Google SSO callback failed')
    return redirectToLogin('google_failed')
  }
}
