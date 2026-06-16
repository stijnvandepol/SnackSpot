import { type NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { issueSession } from '@/lib/session'
import { getGoogleProvider, validateGoogleCallback } from '@/lib/oauth/google'
import { decideAccountAction, type GoogleClaims } from '@/lib/oauth/account-resolution'
import { generateUniqueUsername } from '@/lib/username'
import { OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from '../route'

type SessionUser = { id: string; email: string; username: string; role: 'USER' | 'MODERATOR' | 'ADMIN' }
type ResolveResult = { ok: true; user: SessionUser } | { ok: false; reason: string }

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

/** Resolve the Google identity to a SnackSpot user and perform the link/create.
 *  Pure DB work — safe to retry (does NOT re-exchange the one-time auth code).
 *  On a concurrent-first-login race the unique index throws P2002; the caller
 *  retries once, by which point the account link exists and resolution returns
 *  a plain login. */
async function resolveSessionUser(claims: GoogleClaims): Promise<ResolveResult> {
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

  if (action.type === 'reject') return { ok: false, reason: action.reason }

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
    return { ok: true, user }
  }

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
  return { ok: true, user }
}

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
    // The auth code is single-use, so exchange it exactly once.
    const claims = await validateGoogleCallback(google, code, codeVerifier)

    // Resolve to a user. A concurrent first-login can race the unique index and
    // throw P2002; retry the (idempotent) DB resolution once — by then the link
    // exists and resolution returns a plain login instead of a duplicate create.
    let resolved: ResolveResult
    try {
      resolved = await resolveSessionUser(claims)
    } catch (e) {
      if (!isUniqueViolation(e)) throw e
      resolved = await resolveSessionUser(claims)
    }

    if (!resolved.ok) return redirectToLogin(resolved.reason)

    const { setCookie } = await issueSession(resolved.user)
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
