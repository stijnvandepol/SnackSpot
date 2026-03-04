import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((s) => s.trim())

function corsHeaders(origin: string | null, isPreflight: boolean): Headers {
  const headers = new Headers()
  const allowed = origin && CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0]
  headers.set('Access-Control-Allow-Origin', allowed)
  headers.set('Access-Control-Allow-Credentials', 'true')
  if (isPreflight) {
    headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    headers.set('Access-Control-Max-Age', '86400')
  }
  return headers
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin')

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin, true) })
  }

  const res = NextResponse.next()

  // Attach CORS headers to all API responses
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const ch = corsHeaders(origin, false)
    ch.forEach((value, key) => res.headers.set(key, value))
  }

  return res
}

export const config = {
  matcher: ['/api/:path*'],
}
