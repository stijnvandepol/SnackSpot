import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_REFRESH_COOKIE,
  buildClearAdminCookie,
  buildClearRefreshCookie,
  revokeRefreshToken,
} from '@/lib/auth'

export async function POST(req: NextRequest) {
  const rawToken = req.cookies.get(ADMIN_REFRESH_COOKIE)?.value
  if (rawToken) {
    await revokeRefreshToken(rawToken).catch(() => {})
  }

  const response = NextResponse.json({ success: true })
  response.headers.append('Set-Cookie', buildClearAdminCookie())
  response.headers.append('Set-Cookie', buildClearRefreshCookie())
  return response
}
