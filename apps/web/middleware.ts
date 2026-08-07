import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'https://snackspot.online')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

// Only trust x-forwarded-host when explicitly configured — mirrors the same guard used in
// api-helpers.ts:requireSameOrigin. Unconditionally trusting this header allows an attacker
// outside the proxy to spoof it and bypass the ALLOWED_HOSTS check.
const TRUST_PROXY = process.env.TRUST_PROXY === 'true'

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
  const host = ((TRUST_PROXY ? req.headers.get('x-forwarded-host') : null) ?? req.headers.get('host') ?? '').toLowerCase()

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
    preflight.headers.set('X-Request-ID', crypto.randomUUID())
    return preflight
  }

  const res = NextResponse.next()
  res.headers.set('X-Request-ID', crypto.randomUUID())
  res.headers.set('X-Response-Time', `${Date.now() - startedAt}ms`)

  // Attach CORS headers to all API responses
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const ch = corsHeaders(origin, false)
    ch.forEach((value, key) => res.headers.set(key, value))
    // Override Vary to only include relevant headers for API responses.
    // Next.js adds RSC-related Vary headers that prevent Cloudflare from caching.
    res.headers.set('Vary', 'Accept, Origin')
    res.headers.delete('x-nextjs-cache')
  }

  return res
}

// Everything except static assets and crawler-facing files.
//
// Running middleware on a path makes Next.js attach RSC routing headers to the response
// (`vary: rsc, next-router-state-tree, …`). Cloudflare cannot normalise those and refuses
// to cache the response — which left /sitemap.xml at cf-cache-status DYNAMIC and
// /robots.txt at EXPIRED, sending every crawler fetch to the origin. That made robots.txt
// unfetchable during origin incidents, and Google responds by pausing crawling of the
// whole host (1.32% of requests in the Aug 2026 crawl stats).
//
// Dropping these paths is safe: none of them render host-derived content. lib/site-url.ts
// resolves URLs from NEXT_PUBLIC_APP_URL only — never from the Host header — so skipping
// the ALLOWED_HOSTS guard here cannot enable host-header injection. Auth and API routes,
// where that guard does matter, remain covered.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|icons/|opengraph-image|twitter-image|apple-icon).*)',
  ],
}
