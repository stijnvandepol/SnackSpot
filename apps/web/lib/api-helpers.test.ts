import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock verifyAccessToken so we control what tokens are "valid" without needing
// real JWT secrets or the environment to be configured.
vi.mock('./auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./auth')>()
  return {
    ...actual,
    verifyAccessToken: vi.fn(),
  }
})

import { verifyAccessToken } from './auth'
import {
  ok,
  created,
  noContent,
  err,
  validationError,
  isResponse,
  requireAuth,
  requireRole,
  parseBody,
  parseQuery,
  withPublicCache,
} from './api-helpers'

// ─── ok / err / created / noContent ──────────────────────────────────────────

describe('ok()', () => {
  it('returns HTTP 200 with data wrapped in {data}', async () => {
    const res = ok({ id: 1 })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ data: { id: 1 } })
  })

  it('accepts a custom status code', async () => {
    const res = ok({ foo: 'bar' }, 202)
    expect(res.status).toBe(202)
  })
})

describe('created()', () => {
  it('returns HTTP 201 with data', async () => {
    const res = created({ id: 'new' })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual({ data: { id: 'new' } })
  })
})

describe('noContent()', () => {
  it('returns HTTP 204 with no body', async () => {
    const res = noContent()
    expect(res.status).toBe(204)
    const text = await res.text()
    expect(text).toBe('')
  })
})

describe('err()', () => {
  it('returns the given status with error message in {error}', async () => {
    const res = err('Not found', 404)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toEqual({ error: 'Not found' })
  })

  it('includes details when provided', async () => {
    const res = err('Validation error', 422, { field: 'email' })
    const body = await res.json()
    expect(body.details).toEqual({ field: 'email' })
  })

  it('omits details key when details is undefined', async () => {
    const res = err('Oops', 500)
    const body = await res.json()
    expect('details' in body).toBe(false)
  })
})

describe('validationError()', () => {
  it('returns HTTP 422 with details', async () => {
    const res = validationError({ field: 'email', message: 'Required' })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('Validation error')
    expect(body.details).toEqual({ field: 'email', message: 'Required' })
  })
})

// ─── isResponse ───────────────────────────────────────────────────────────────

describe('isResponse()', () => {
  it('returns true for a Response instance', () => {
    expect(isResponse(new Response(null, { status: 200 }))).toBe(true)
  })

  it('returns false for a plain object', () => {
    expect(isResponse({ status: 200 })).toBe(false)
  })

  it('returns false for a string', () => {
    expect(isResponse('response')).toBe(false)
  })

  it('returns false for null', () => {
    expect(isResponse(null)).toBe(false)
  })
})

// ─── withPublicCache ──────────────────────────────────────────────────────────

describe('withPublicCache()', () => {
  it('sets Cache-Control with provided max-age and stale-while-revalidate', async () => {
    const base = ok({ x: 1 })
    const cached = await withPublicCache(base, 30, 120)
    expect(cached.headers.get('Cache-Control')).toBe('public, max-age=30, stale-while-revalidate=120')
  })

  it('uses defaults of 15s / 60s when not specified', async () => {
    const cached = await withPublicCache(ok({}))
    expect(cached.headers.get('Cache-Control')).toBe('public, max-age=15, stale-while-revalidate=60')
  })

  it('sets Vary to "Accept, Origin"', async () => {
    const cached = await withPublicCache(ok({}))
    expect(cached.headers.get('Vary')).toBe('Accept, Origin')
  })

  it('strips x-nextjs-cache header', async () => {
    const base = ok({})
    base.headers.set('x-nextjs-cache', 'HIT')
    const cached = await withPublicCache(base)
    expect(cached.headers.get('x-nextjs-cache')).toBeNull()
  })

  it('preserves the original status code', async () => {
    const base = ok({}, 202)
    const cached = await withPublicCache(base)
    expect(cached.status).toBe(202)
  })

  it('preserves the response body', async () => {
    const base = ok({ hello: 'world' })
    const cached = await withPublicCache(base)
    expect(await cached.json()).toEqual({ data: { hello: 'world' } })
  })
})

// ─── requireAuth ─────────────────────────────────────────────────────────────

describe('requireAuth()', () => {
  beforeEach(() => {
    vi.mocked(verifyAccessToken).mockReset()
  })

  it('returns a 401 Response when Authorization header is absent', () => {
    const req = new NextRequest('http://localhost/api/test')
    const result = requireAuth(req)
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('returns a 401 Response when header does not start with "Bearer "', () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    })
    const result = requireAuth(req)
    expect((result as Response).status).toBe(401)
  })

  it('returns a 401 Response when verifyAccessToken throws', () => {
    vi.mocked(verifyAccessToken).mockImplementation(() => {
      throw new Error('invalid signature')
    })
    const req = new NextRequest('http://localhost/api/test', {
      headers: { Authorization: 'Bearer bad.token' },
    })
    const result = requireAuth(req)
    expect((result as Response).status).toBe(401)
  })

  it('returns the token payload when the token is valid', () => {
    const payload = { sub: 'user-1', role: 'USER' as const, username: 'tester' }
    vi.mocked(verifyAccessToken).mockReturnValue(payload as ReturnType<typeof verifyAccessToken>)
    const req = new NextRequest('http://localhost/api/test', {
      headers: { Authorization: 'Bearer valid.token' },
    })
    const result = requireAuth(req)
    expect(result).not.toBeInstanceOf(Response)
    expect((result as typeof payload).sub).toBe('user-1')
  })
})

// ─── requireRole ─────────────────────────────────────────────────────────────

describe('requireRole()', () => {
  beforeEach(() => {
    vi.mocked(verifyAccessToken).mockReset()
  })

  it('returns 401 when no token is present', () => {
    const req = new NextRequest('http://localhost/api/admin')
    const result = requireRole(req, 'ADMIN')
    expect((result as Response).status).toBe(401)
  })

  it('returns 403 when user role is below required role', () => {
    vi.mocked(verifyAccessToken).mockReturnValue({
      sub: 'u1', role: 'USER', username: 'basic',
    } as ReturnType<typeof verifyAccessToken>)
    const req = new NextRequest('http://localhost/api/admin', {
      headers: { Authorization: 'Bearer token' },
    })
    const result = requireRole(req, 'ADMIN')
    expect((result as Response).status).toBe(403)
  })

  it('returns the payload when role is exactly the minimum', () => {
    vi.mocked(verifyAccessToken).mockReturnValue({
      sub: 'u2', role: 'MODERATOR', username: 'mod',
    } as ReturnType<typeof verifyAccessToken>)
    const req = new NextRequest('http://localhost/api/mod', {
      headers: { Authorization: 'Bearer token' },
    })
    const result = requireRole(req, 'MODERATOR')
    expect(result).not.toBeInstanceOf(Response)
  })

  it('returns the payload when role exceeds the minimum (ADMIN satisfies MODERATOR)', () => {
    vi.mocked(verifyAccessToken).mockReturnValue({
      sub: 'u3', role: 'ADMIN', username: 'admin',
    } as ReturnType<typeof verifyAccessToken>)
    const req = new NextRequest('http://localhost/api/mod', {
      headers: { Authorization: 'Bearer token' },
    })
    const result = requireRole(req, 'MODERATOR')
    expect(result).not.toBeInstanceOf(Response)
  })
})

// ─── parseBody ────────────────────────────────────────────────────────────────

const simpleSchema = {
  safeParse(data: unknown) {
    if (typeof data === 'object' && data !== null && 'name' in data) {
      return { success: true as const, data: (data as { name: string }).name }
    }
    return {
      success: false as const,
      error: { flatten: () => ({ fieldErrors: { name: ['Required'] }, formErrors: [] }) },
    }
  },
}

describe('parseBody()', () => {
  it('returns parsed data for valid JSON body', async () => {
    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'SnackSpot' }),
    })
    const result = await parseBody(req, simpleSchema)
    expect(result).toBe('SnackSpot')
  })

  it('returns a 400 Response for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not valid json',
    })
    const result = await parseBody(req, simpleSchema)
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(400)
  })

  it('returns a 422 Response when schema validation fails', async () => {
    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ other: 'field' }),
    })
    const result = await parseBody(req, simpleSchema)
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(422)
  })
})

// ─── parseQuery ───────────────────────────────────────────────────────────────

const querySchema = {
  safeParse(data: unknown) {
    const d = data as Record<string, string>
    if (d?.q && d.q.length > 0) {
      return { success: true as const, data: { q: d.q } }
    }
    return {
      success: false as const,
      error: { flatten: () => ({ fieldErrors: { q: ['Required'] }, formErrors: [] }) },
    }
  },
}

describe('parseQuery()', () => {
  it('returns parsed query params for a valid query string', () => {
    const req = new NextRequest('http://localhost/api?q=fries')
    const result = parseQuery(req, querySchema)
    expect(result).toEqual({ q: 'fries' })
  })

  it('returns a 422 Response when required query param is missing', () => {
    const req = new NextRequest('http://localhost/api')
    const result = parseQuery(req, querySchema)
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(422)
  })
})
