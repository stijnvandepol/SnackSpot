import { type NextRequest } from 'next/server'
import { DeleteAccountSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { verifyPassword, buildClearCookie } from '@/lib/auth'
import { rateLimitUser } from '@/lib/rate-limit'
import { ok, err, parseBody, requireAuth, requireSameOrigin, serverError, isResponse, withNoStore } from '@/lib/api-helpers'

export async function DELETE(req: NextRequest) {
  const sameOrigin = requireSameOrigin(req)
  if (sameOrigin) return sameOrigin

  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  // 5 attempts per 15 min — prevents password brute-force via this endpoint
  const rl = await rateLimitUser(auth.sub, 'delete_account', 5, 900)
  if (!rl.allowed) return err('Too many requests', 429)

  const body = await parseBody(req, DeleteAccountSchema)
  if (isResponse(body)) return body

  try {
    // Always look up by auth.sub (cryptographically verified JWT claim) —
    // never a user-supplied ID, so token tampering cannot target other accounts.
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: { id: true, passwordHash: true },
    })
    if (!user) return err('User not found', 404)

    const valid = await verifyPassword(user.passwordHash, body.password)
    if (!valid) return err('Incorrect password', 403)

    // Delete the user — Prisma cascades to all related records (reviews, photos,
    // comments, likes, tokens, notifications, etc.) per the schema onDelete rules.
    await prisma.user.delete({ where: { id: user.id } })

    const res = withNoStore(ok({ message: 'Account deleted' }))
    res.headers.set('Set-Cookie', buildClearCookie())
    return res
  } catch (e) {
    return serverError('me/delete', e)
  }
}
