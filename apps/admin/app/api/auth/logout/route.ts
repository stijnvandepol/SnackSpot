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
    // Best-effort: the token may already be revoked or expired; logout must
    // still clear the cookies regardless.
    await revokeRefreshToken(rawToken).catch(() => {})
  }

  const response = NextResponse.json({ success: true })
  response.headers.append('Set-Cookie', buildClearAdminCookie())
  response.headers.append('Set-Cookie', buildClearRefreshCookie())
  return response
}
