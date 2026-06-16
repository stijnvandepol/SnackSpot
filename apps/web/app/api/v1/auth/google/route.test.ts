// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Control the provider without real Google credentials.
vi.mock('@/lib/oauth/google', () => ({
  getGoogleProvider: vi.fn(),
  createGoogleAuthUrl: vi.fn(),
}))

import { NextRequest } from 'next/server'
import { GET } from './route'
import { OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from '@/lib/oauth/oauth-cookies'
import { getGoogleProvider, createGoogleAuthUrl } from '@/lib/oauth/google'

const start = () => GET(new NextRequest('https://snackspot.online/api/v1/auth/google'))

describe('GET /api/v1/auth/google (OAuth start)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('404s when Google SSO is not configured', async () => {
    vi.mocked(getGoogleProvider).mockReturnValue(null)
    const res = await start()
    expect(res.status).toBe(404)
    // No handshake cookies should be set when the feature is off.
    expect(res.headers.getSetCookie()).toHaveLength(0)
  })

  it('302-redirects to Google with httpOnly SameSite=Lax state + PKCE cookies', async () => {
    vi.mocked(getGoogleProvider).mockReturnValue({} as never)
    vi.mocked(createGoogleAuthUrl).mockReturnValue(
      new URL('https://accounts.google.com/o/oauth2/v2/auth?client_id=x'),
    )

    const res = await start()
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('accounts.google.com')

    const cookies = res.headers.getSetCookie()
    expect(cookies).toHaveLength(2)
    const joined = cookies.join('\n')
    expect(joined).toContain(`${OAUTH_STATE_COOKIE}=`)
    expect(joined).toContain(`${OAUTH_VERIFIER_COOKIE}=`)

    // Security attributes on BOTH cookies.
    for (const c of cookies) {
      expect(c).toMatch(/HttpOnly/i)
      expect(c).toMatch(/SameSite=Lax/i) // Lax (not Strict) so it survives Google's return redirect
      expect(c).toMatch(/Max-Age=600\b/) // short-lived (10 min)
      expect(c).toMatch(/Path=\//)
    }
  })

  it('generates a fresh, unpredictable state on every request (no fixation)', async () => {
    vi.mocked(getGoogleProvider).mockReturnValue({} as never)
    vi.mocked(createGoogleAuthUrl).mockReturnValue(new URL('https://accounts.google.com/o/oauth2/v2/auth'))

    const stateOf = (res: Response) =>
      res.headers.getSetCookie().find((c) => c.startsWith(`${OAUTH_STATE_COOKIE}=`))!.split(';')[0].split('=')[1]

    const a = stateOf(await start())
    const b = stateOf(await start())
    expect(a).toBeTruthy()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(20) // high-entropy token, not a guessable value
  })
})
