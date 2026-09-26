import { type NextRequest } from 'next/server'
import { generateState, generateCodeVerifier } from 'arctic'
import { getGoogleProvider, createGoogleAuthUrl } from '@/lib/oauth/google'
import { OAUTH_NEXT_COOKIE, OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from '@/lib/oauth/oauth-cookies'
import { DEFAULT_NEXT_PATH, safeNextPath } from '@/lib/next-path'
import { err } from '@/lib/api-helpers'

const TEN_MINUTES = 60 * 10

function tempCookie(name: string, value: string, secure: boolean): string {
  // SameSite=Lax (NOT Strict): the cookie must survive the top-level redirect
  // back from accounts.google.com to our callback.
  return [
    `${name}=${value}`,
    `Max-Age=${TEN_MINUTES}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}

export async function GET(req: NextRequest) {
  const google = getGoogleProvider()
  if (!google) return err('Inloggen met Google is nu niet beschikbaar.', 404)

  const state = generateState()
  const codeVerifier = generateCodeVerifier()
  const url = createGoogleAuthUrl(google, state, codeVerifier)

  const secure = process.env.NODE_ENV === 'production'
  const headers = new Headers()
  headers.append('Set-Cookie', tempCookie(OAUTH_STATE_COOKIE, state, secure))
  headers.append('Set-Cookie', tempCookie(OAUTH_VERIFIER_COOKIE, codeVerifier, secure))
  const next = safeNextPath(req.nextUrl.searchParams.get('next'))
  if (next !== DEFAULT_NEXT_PATH) {
    headers.append('Set-Cookie', tempCookie(OAUTH_NEXT_COOKIE, encodeURIComponent(next), secure))
  }
  headers.set('Location', url.toString())
  return new Response(null, { status: 302, headers })
}
