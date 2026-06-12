import { type NextRequest } from 'next/server'
import { DeleteAccountSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { verifyPassword, buildClearCookie } from '@/lib/auth'
import { rateLimitUser } from '@/lib/rate-limit'
import { ok, err, parseBody, requireAuth, requireSameOrigin, serverError, isResponse, withNoStore } from '@/lib/api-helpers'
import { photoObjectKeys, avatarObjectKeys, removeObjectsBestEffort } from '@/lib/storage-cleanup'
import { logPrivacyAction } from '@/lib/privacy-audit'

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
      select: { id: true, passwordHash: true, avatarKey: true },
    })
    if (!user) return err('User not found', 404)

    const valid = await verifyPassword(user.passwordHash, body.password)
    if (!valid) return err('Incorrect password', 403)

    // Collect every MinIO object key BEFORE the delete: the cascade removes
    // the Photo rows, and with them the only reference to the stored files.
    const photos = await prisma.photo.findMany({
      where: { uploaderId: user.id },
      select: { storageKey: true, variants: true },
    })
    const objectKeys = [
      ...photos.flatMap(photoObjectKeys),
      ...avatarObjectKeys(user.avatarKey),
    ]

    // Delete the user — Prisma cascades to all related records (reviews, photos,
    // comments, likes, tokens, notifications, etc.) per the schema onDelete rules.
    await prisma.user.delete({ where: { id: user.id } })

    // GDPR Art. 17: erase uploaded files immediately rather than waiting for
    // the daily orphan sweep (which remains the safety net for any failures).
    await removeObjectsBestEffort(objectKeys, 'account-deletion')

    // Accountability (Art. 5(2)): record the deletion. Only the opaque user id
    // is stored, so the entry is not linkable to a person after erasure.
    await logPrivacyAction(user.id, 'ACCOUNT_DELETED', { photoCount: photos.length })

    const res = withNoStore(ok({ message: 'Account deleted' }))
    res.headers.set('Set-Cookie', buildClearCookie())
    return res
  } catch (e) {
    return serverError('me/delete', e)
  }
}
