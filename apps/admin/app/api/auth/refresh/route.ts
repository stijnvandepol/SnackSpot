import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_REFRESH_COOKIE,
  rotateRefreshToken,
  signAdminAccessToken,
  buildSetAdminCookie,
  buildSetRefreshCookie,
  buildClearAdminCookie,
  buildClearRefreshCookie,
} from '@/lib/auth'

export async function POST(req: NextRequest) {
  const rawToken = req.cookies.get(ADMIN_REFRESH_COOKIE)?.value
  if (!rawToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await rotateRefreshToken(rawToken)
    if (!result) {
      // Invalid or stolen token — clear everything
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      res.headers.append('Set-Cookie', buildClearAdminCookie())
      res.headers.append('Set-Cookie', buildClearRefreshCookie())
      return res
    }

    const accessToken = signAdminAccessToken(result.payload)

    const res = NextResponse.json({
      user: {
        id: result.payload.sub,
        email: result.payload.email,
        username: result.payload.username,
        role: result.payload.role,
      },
    })
    res.headers.append('Set-Cookie', buildSetAdminCookie(accessToken))
    res.headers.append('Set-Cookie', buildSetRefreshCookie(result.newRawToken))
    return res
  } catch {
    return NextResponse.json({ error: 'Er is een fout opgetreden' }, { status: 500 })
  }
}
