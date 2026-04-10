import { NextRequest, NextResponse } from 'next/server'

/** Only the admin's own origin may call the API. */
const ALLOWED_ORIGINS = new Set([
  'https://mgmt.snackspot.online',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
])

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only guard API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const origin = req.headers.get('origin')

  // Preflight
  if (req.method === 'OPTIONS') {
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return new NextResponse(null, { status: 403 })
    }
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  const res = NextResponse.next()

  // Attach CORS headers for allowed origins
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin)
    res.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  res.headers.set('Vary', 'Origin')

  return res
}

export const config = {
  matcher: '/api/:path*',
}
