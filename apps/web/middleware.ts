import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:8080')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

function corsHeaders(origin: string | null, isPreflight: boolean): Headers {
  const headers = new Headers()
  const allowed = origin && CORS_ORIGINS.includes(origin) ? origin : null
  if (allowed) {
    headers.set('Access-Control-Allow-Origin', allowed)
    headers.set('Access-Control-Allow-Credentials', 'true')
  }
  if (isPreflight) {
    headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    headers.set('Access-Control-Max-Age', '86400')
  }
  return headers
}

export function middleware(req: NextRequest) {
  const startedAt = Date.now()
  const origin = req.headers.get('origin')
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').toLowerCase()

  if (ALLOWED_HOSTS.length > 0 && host && !ALLOWED_HOSTS.includes(host)) {
    return new Response('Host not allowed', { status: 400 })
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    const allowed = origin && CORS_ORIGINS.includes(origin)
    if (!allowed) {
      return new Response(null, { status: 403 })
    }
    const preflight = new Response(null, { status: 204, headers: corsHeaders(origin, true) })
    preflight.headers.set('Vary', 'Origin')
    preflight.headers.set('X-Request-ID', req.headers.get('x-request-id') ?? crypto.randomUUID())
    return preflight
  }

  const res = NextResponse.next()
  res.headers.set('X-Request-ID', req.headers.get('x-request-id') ?? crypto.randomUUID())
  res.headers.set('X-Response-Time', `${Date.now() - startedAt}ms`)

  // Attach CORS headers to all API responses
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const ch = corsHeaders(origin, false)
    ch.forEach((value, key) => res.headers.set(key, value))
    res.headers.set('Vary', 'Origin')
  }

  return res
}

export const config = {
  matcher: ['/:path*'],
}
