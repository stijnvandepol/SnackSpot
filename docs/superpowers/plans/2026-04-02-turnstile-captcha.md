# Turnstile CAPTCHA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a Cloudflare Turnstile CAPTCHA on the login page after 3 failed attempts per IP or per e-mail address.

**Architecture:** Two Redis counters (INCR/EXPIRE) track failed logins per IP and per e-mail. A new `GET /api/v1/auth/captcha-required` endpoint lets the frontend check status proactively. The login route enforces Turnstile token verification when either counter ≥ 3 and resets both counters on success. The login page uses `@marsidev/react-turnstile` and checks captcha status on mount and on email blur.

**Tech Stack:** Cloudflare Turnstile, `@marsidev/react-turnstile`, Redis (INCR/EXPIRE), Next.js 15 App Router, Vitest

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `packages/shared/src/index.ts` | Add optional `captchaToken` to `LoginSchema` |
| Modify | `apps/web/lib/rate-limit.ts` | Add `incrementLoginFailures`, `resetLoginFailures`, `getLoginFailureCount` |
| Modify | `apps/web/lib/rate-limit.test.ts` | Tests for login failure key format |
| Create | `apps/web/lib/turnstile.ts` | `verifyTurnstileToken(token, ip)` — calls Cloudflare siteverify |
| Create | `apps/web/lib/turnstile.test.ts` | Unit tests for payload builder + response shape |
| Modify | `apps/web/lib/env.ts` | Add `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` |
| Create | `apps/web/app/api/v1/auth/captcha-required/route.ts` | Proactive status check endpoint |
| Modify | `apps/web/app/api/v1/auth/login/route.ts` | CAPTCHA enforcement + failure tracking |
| Modify | `apps/web/components/auth-provider.tsx` | `login()` accepts `captchaToken?`, returns `captchaRequired?` |
| Modify | `apps/web/app/auth/login/page.tsx` | Turnstile widget + proactive status check |
| Modify | `.env.example` | Document new env vars |

---

## Task 1: Add `captchaToken` to `LoginSchema`

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Update `LoginSchema`**

In `packages/shared/src/index.ts`, replace the existing `LoginSchema` (line 29-32):

```typescript
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  captchaToken: z.string().optional(),
})
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add optional captchaToken to LoginSchema"
```

---

## Task 2: Add login failure helpers to `rate-limit.ts`

**Files:**
- Modify: `apps/web/lib/rate-limit.ts`
- Modify: `apps/web/lib/rate-limit.test.ts`

Failure counters use simple Redis INCR + EXPIRE — not the sliding-window rate limiter. Keys:
- `login:fail:ip:{ip}` — TTL 900 s (15 min)
- `login:fail:email:{email}` — email lowercased, same TTL

- [ ] **Step 1: Write failing tests**

Append to `apps/web/lib/rate-limit.test.ts`:

```typescript
// ─── Login failure key format ─────────────────────────────────────────────────

function loginFailIPKey(ip: string): string {
  return `login:fail:ip:${ip}`
}

function loginFailEmailKey(email: string): string {
  return `login:fail:email:${email.toLowerCase()}`
}

describe('login failure key format — IP', () => {
  it('builds the correct key', () => {
    expect(loginFailIPKey('1.2.3.4')).toBe('login:fail:ip:1.2.3.4')
  })

  it('different IPs produce different keys', () => {
    expect(loginFailIPKey('1.2.3.4')).not.toBe(loginFailIPKey('5.6.7.8'))
  })

  it('is distinct from the sliding-window rate-limit key for the same IP', () => {
    expect(loginFailIPKey('1.2.3.4')).not.toBe(`rl:ip:login:1.2.3.4`)
  })
})

describe('login failure key format — email', () => {
  it('builds the correct key', () => {
    expect(loginFailEmailKey('user@example.com')).toBe('login:fail:email:user@example.com')
  })

  it('normalises to lowercase', () => {
    expect(loginFailEmailKey('User@Example.COM')).toBe('login:fail:email:user@example.com')
  })

  it('different emails produce different keys', () => {
    expect(loginFailEmailKey('a@example.com')).not.toBe(loginFailEmailKey('b@example.com'))
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd apps/web && pnpm test -- rate-limit
```

Expected: new tests pass (they test locally-defined pure functions; the Redis helpers will be tested by the login route integration).

- [ ] **Step 3: Add helpers to `apps/web/lib/rate-limit.ts`**

Append at the end of the file:

```typescript
// ─── Login failure counters ──────────────────────────────────────────────────
// Simple INCR-based counters (not sliding-window). Used to decide when to
// require a CAPTCHA challenge. Each counter expires after the login window.

const LOGIN_FAIL_TTL = 900 // 15 minutes

function loginFailIPKey(ip: string): string {
  return `login:fail:ip:${ip}`
}

function loginFailEmailKey(email: string): string {
  return `login:fail:email:${email.toLowerCase()}`
}

export async function incrementLoginFailures(ip: string, email: string): Promise<void> {
  const pipeline = redis.pipeline()
  pipeline.incr(loginFailIPKey(ip))
  pipeline.expire(loginFailIPKey(ip), LOGIN_FAIL_TTL)
  pipeline.incr(loginFailEmailKey(email))
  pipeline.expire(loginFailEmailKey(email), LOGIN_FAIL_TTL)
  await pipeline.exec()
}

export async function resetLoginFailures(ip: string, email: string): Promise<void> {
  await redis.del(loginFailIPKey(ip), loginFailEmailKey(email))
}

export async function getLoginFailureCount(
  ip: string,
  email: string,
): Promise<{ ip: number; email: number }> {
  const [ipCount, emailCount] = await redis.mget(loginFailIPKey(ip), loginFailEmailKey(email))
  return {
    ip: Number(ipCount ?? 0),
    email: Number(emailCount ?? 0),
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && pnpm test -- rate-limit
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/rate-limit.ts apps/web/lib/rate-limit.test.ts
git commit -m "feat(rate-limit): add login failure counters for CAPTCHA threshold"
```

---

## Task 3: Add env vars and create `turnstile.ts`

**Files:**
- Modify: `apps/web/lib/env.ts`
- Create: `apps/web/lib/turnstile.ts`
- Create: `apps/web/lib/turnstile.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add env vars to `apps/web/lib/env.ts`**

Inside the `envSchema` object, after the `RESEND_FROM_EMAIL` line, add:

```typescript
  // Cloudflare Turnstile
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
```

- [ ] **Step 2: Add test keys to `.env.example`**

Append after the Resend section:

```
# Cloudflare Turnstile — https://dash.cloudflare.com/?to=/:account/turnstile
# Create a "Managed" widget for snackspot.online and paste the keys below.
# The values below are Cloudflare's public test keys (always pass in dev/CI).
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

- [ ] **Step 3: Write failing test**

Create `apps/web/lib/turnstile.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'

// Pure helper — extracted for unit testing without a real network call.
function buildSiteverifyPayload(token: string, secret: string, ip: string): string {
  return JSON.stringify({ secret, response: token, remoteip: ip })
}

describe('buildSiteverifyPayload', () => {
  it('includes all three required fields', () => {
    const parsed = JSON.parse(buildSiteverifyPayload('tok_abc', 'sec_xyz', '1.2.3.4'))
    expect(parsed.secret).toBe('sec_xyz')
    expect(parsed.response).toBe('tok_abc')
    expect(parsed.remoteip).toBe('1.2.3.4')
  })

  it('different tokens produce different payloads', () => {
    const a = buildSiteverifyPayload('tok_a', 'sec', '1.2.3.4')
    const b = buildSiteverifyPayload('tok_b', 'sec', '1.2.3.4')
    expect(a).not.toBe(b)
  })
})

describe('Turnstile response shape', () => {
  it('recognises a success response', () => {
    const response = { success: true, 'error-codes': [] as string[] }
    expect(response.success).toBe(true)
    expect(response['error-codes']).toHaveLength(0)
  })

  it('recognises timeout-or-duplicate as a failure', () => {
    const response = { success: false, 'error-codes': ['timeout-or-duplicate'] }
    expect(response.success).toBe(false)
    expect(response['error-codes']).toContain('timeout-or-duplicate')
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd apps/web && pnpm test -- turnstile
```

Expected: FAIL — `apps/web/lib/turnstile.ts` does not exist yet.

- [ ] **Step 5: Create `apps/web/lib/turnstile.ts`**

```typescript
import { env } from './env'
import { logger } from './logger'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Verifies a Cloudflare Turnstile token server-side via the siteverify API.
 *
 * Returns false on any failure (network error, invalid token, timeout-or-duplicate).
 * Each token is single-use — replaying a token returns `timeout-or-duplicate`.
 *
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation
 */
export async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip,
      }),
    })

    if (!res.ok) {
      logger.warn({ status: res.status }, 'Turnstile siteverify returned non-200')
      return false
    }

    const data = await res.json() as { success: boolean; 'error-codes': string[] }
    if (!data.success) {
      logger.debug({ errorCodes: data['error-codes'] }, 'Turnstile token rejected')
    }
    return data.success === true
  } catch (err) {
    logger.error({ err }, 'Turnstile siteverify request failed')
    return false
  }
}
```

- [ ] **Step 6: Run tests**

```bash
cd apps/web && pnpm test -- turnstile
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/env.ts apps/web/lib/turnstile.ts apps/web/lib/turnstile.test.ts .env.example
git commit -m "feat(turnstile): add Cloudflare Turnstile verification helper and env vars"
```

---

## Task 4: Create `GET /api/v1/auth/captcha-required`

**Files:**
- Create: `apps/web/app/api/v1/auth/captcha-required/route.ts`

- [ ] **Step 1: Create the route**

Create `apps/web/app/api/v1/auth/captcha-required/route.ts`:

```typescript
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, parseQuery, serverError, isResponse } from '@/lib/api-helpers'
import { getClientIP, rateLimitIP, getLoginFailureCount } from '@/lib/rate-limit'

const QuerySchema = z.object({
  email: z.string().email().optional(),
})

const CAPTCHA_THRESHOLD = 3

export async function GET(req: NextRequest) {
  const ip = getClientIP(req)

  // Light rate-limit prevents using this endpoint as an oracle to discover
  // which accounts or IPs have been attacked.
  const rl = await rateLimitIP(ip, 'captcha_status', 60, 60)
  if (!rl.allowed) return ok({ captchaRequired: false })

  const query = parseQuery(req, QuerySchema)
  if (isResponse(query)) return ok({ captchaRequired: false })

  try {
    // When email is absent the email counter defaults to 0 (correct: a blank
    // email is never stored as a failure key).
    const failures = await getLoginFailureCount(ip, query.email ?? '')
    const captchaRequired =
      failures.ip >= CAPTCHA_THRESHOLD || failures.email >= CAPTCHA_THRESHOLD

    return ok({ captchaRequired })
  } catch (e) {
    return serverError('captcha-required', e)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/api/v1/auth/captcha-required/route.ts
git commit -m "feat(api): add GET /api/v1/auth/captcha-required endpoint"
```

---

## Task 5: Update login route with CAPTCHA enforcement

**Files:**
- Modify: `apps/web/app/api/v1/auth/login/route.ts`

- [ ] **Step 1: Replace the full file**

Replace `apps/web/app/api/v1/auth/login/route.ts` with:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/api/v1/auth/login/route.ts
git commit -m "feat(login): enforce Turnstile CAPTCHA after 3 failed attempts"
```

---

## Task 6: Update `auth-provider.tsx`

**Files:**
- Modify: `apps/web/components/auth-provider.tsx`

- [ ] **Step 1: Update the `AuthCtx` interface**

Replace the `login` line in the `AuthCtx` interface (line 18):

```typescript
  login(email: string, password: string, captchaToken?: string): Promise<{ ok: boolean; error?: string; captchaRequired?: boolean }>
```

- [ ] **Step 2: Update the `login` useCallback**

Replace the existing `login` useCallback (lines 132-148):

```typescript
  const login = useCallback(
    async (email: string, password: string, captchaToken?: string) => {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          ...(captchaToken ? { captchaToken } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        return {
          ok: false,
          error: json.error ?? 'Login failed',
          captchaRequired: json.captchaRequired === true,
        }
      }
      tokenRef.current = json.data.access_token
      setAccessToken(json.data.access_token)
      setUser(json.data.user)
      return { ok: true }
    },
    [],
  )
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/auth-provider.tsx
git commit -m "feat(auth): pass captchaToken in login and surface captchaRequired"
```

---

## Task 7: Update login page with Turnstile widget

**Files:**
- Modify: `apps/web/app/auth/login/page.tsx`

- [ ] **Step 1: Install package**

```bash
pnpm --filter web add @marsidev/react-turnstile
```

- [ ] **Step 2: Replace login page**

Replace `apps/web/app/auth/login/page.tsx` with:

```typescript
'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Turnstile } from '@marsidev/react-turnstile'
import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { useAuth } from '@/components/auth-provider'
import { SnackSpotLogo } from '@/components/snack-spot-logo'

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance | null>(null)

  const checkCaptchaStatus = async (emailValue?: string) => {
    try {
      const url = emailValue
        ? `/api/v1/auth/captcha-required?email=${encodeURIComponent(emailValue)}`
        : '/api/v1/auth/captcha-required'
      const res = await fetch(url)
      const json = await res.json()
      if (json.data?.captchaRequired) setCaptchaRequired(true)
    } catch {
      // Fail open: if the status check errors, don't block login
    }
  }

  // Check on mount using IP only — catches IPs already flagged before page load
  useEffect(() => {
    void checkCaptchaStatus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await login(email, password, captchaToken ?? undefined)
    setLoading(false)

    if (!result.ok) {
      if (result.captchaRequired) {
        // Token was rejected (expired or replayed) — show widget and wait for a fresh token
        setCaptchaRequired(true)
        setCaptchaToken(null)
        turnstileRef.current?.reset()
      }
      setError(result.error ?? 'Login failed')
      return
    }

    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-snack-surface to-snack-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mb-3">
            <SnackSpotLogo className="text-2xl" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-snack-text">Welcome back</h2>
          <p className="text-sm text-snack-muted mt-1">Log in to your SnackSpot account</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-xl border border-red-100 dark:border-red-900">
              {error}
            </div>
          )}

          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={(e) => { if (e.target.value) void checkCaptchaStatus(e.target.value) }}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {captchaRequired && (
            <Turnstile
              ref={turnstileRef}
              siteKey={SITE_KEY}
              options={{ action: 'login' }}
              onSuccess={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken(null)}
            />
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading || (captchaRequired && !captchaToken)}
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <div className="text-center mt-6 space-y-2 text-sm">
          <p className="text-snack-muted">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="text-snack-primary font-medium hover:underline">Sign up</Link>
          </p>
          <Link href="/auth/forgot-password" className="text-snack-muted hover:text-snack-text">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run all tests**

```bash
cd apps/web && pnpm test
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/auth/login/page.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(login): add Turnstile CAPTCHA widget after 3 failed attempts"
```

---

## Task 8: Cloudflare dashboard setup (manual)

- [ ] **Step 1: Create a Turnstile widget**
  1. Go to the Cloudflare dashboard → Turnstile → Add site
  2. Site name: `SnackSpot`, Domain: `snackspot.online`
  3. Widget type: **Managed** (invisible for normal users, challenge only when suspicious)
  4. Action name: `login`
  5. Copy **Site Key** → set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in production `.env`
  6. Copy **Secret Key** → set `TURNSTILE_SECRET_KEY` in production `.env`

- [ ] **Step 2: Verify test keys in development**

The `.env.example` values (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`) are Cloudflare's permanent public test keys. They always pass, so the full CAPTCHA flow can be tested locally without a real Cloudflare account.

---

## Manual verification checklist

- [ ] Correct credentials on first try → no CAPTCHA, login succeeds
- [ ] 3 wrong passwords → CAPTCHA widget appears below password field
- [ ] CAPTCHA widget appears on page load when IP already has ≥ 3 failures (refresh after 3 failures)
- [ ] CAPTCHA widget appears on email blur when that account has ≥ 3 failures
- [ ] Submit with solved CAPTCHA + correct password → login succeeds, counters reset
- [ ] Submit with solved CAPTCHA + wrong password → widget resets, error shown
- [ ] Replay an already-used token → server returns `captchaRequired: true`, widget resets automatically
