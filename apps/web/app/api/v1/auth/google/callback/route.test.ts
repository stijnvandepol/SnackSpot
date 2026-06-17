// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Control the provider + token exchange without real Google. prisma is never
// reached on the CSRF/guard paths exercised here, so no DB is required.
vi.mock('@/lib/oauth/google', () => ({
  getGoogleProvider: vi.fn(),
  validateGoogleCallback: vi.fn(),
}))

import { NextRequest } from 'next/server'
import { GET } from './route'
import { OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from '@/lib/oauth/oauth-cookies'
import { getGoogleProvider, validateGoogleCallback } from '@/lib/oauth/google'

const CALLBACK = 'https://snackspot.online/api/v1/auth/google/callback'

function call(query: string, cookie?: string) {
  return GET(new NextRequest(`${CALLBACK}${query}`, cookie ? { headers: { cookie } } : undefined))
}

const bothCookies = (state: string, verifier = 'verifier-xyz') =>
  `${OAUTH_STATE_COOKIE}=${state}; ${OAUTH_VERIFIER_COOKIE}=${verifier}`

function clearsTempCookies(res: Response) {
  const joined = res.headers.getSetCookie().join('\n')
  return (
    new RegExp(`${OAUTH_STATE_COOKIE}=;`).test(joined) &&
    new RegExp(`${OAUTH_VERIFIER_COOKIE}=;`).test(joined) &&
    /Max-Age=0/.test(joined)
  )
}

describe('GET /api/v1/auth/google/callback — CSRF & guard security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getGoogleProvider).mockReturnValue({} as never)
  })

  it('redirects with google_unavailable when SSO is not configured', async () => {
    vi.mocked(getGoogleProvider).mockReturnValue(null)
    const res = await call('?code=c&state=s', bothCookies('s'))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/auth/login')
    expect(res.headers.get('location')).toContain('error=google_unavailable')
  })

  it('rejects (invalid_state) when the state cookie is absent — classic CSRF / forged callback', async () => {
    const res = await call('?code=c&state=s' /* no cookies at all */)
    expect(res.headers.get('location')).toContain('error=invalid_state')
    expect(clearsTempCookies(res)).toBe(true)
  })

  it('rejects (invalid_state) when the URL state does not match the cookie state — forged/replayed state', async () => {
    const res = await call('?code=c&state=ATTACKER_CONTROLLED', bothCookies('REAL_SERVER_STATE'))
    expect(res.headers.get('location')).toContain('error=invalid_state')
  })

  it('rejects (invalid_state) when the authorization code is missing', async () => {
    const res = await call('?state=s', bothCookies('s'))
    expect(res.headers.get('location')).toContain('error=invalid_state')
  })

  it('rejects (invalid_state) when the PKCE verifier cookie is missing', async () => {
    const res = await call('?code=c&state=s', `${OAUTH_STATE_COOKIE}=s`)
    expect(res.headers.get('location')).toContain('error=invalid_state')
  })

  it('NEVER exchanges the authorization code when the state guard fails (no token call on CSRF)', async () => {
    await call('?code=c&state=ATTACKER', bothCookies('REAL'))
    await call('?code=c&state=s' /* no cookies */)
    expect(validateGoogleCallback).not.toHaveBeenCalled()
  })

  it('does not leak the SnackSpot session cookie on any rejected request', async () => {
    const res = await call('?code=c&state=x', bothCookies('y'))
    const joined = res.headers.getSetCookie().join('\n')
    expect(joined).not.toContain('snackspot_rt=') // refresh cookie must never be set on a failed login
  })
})
