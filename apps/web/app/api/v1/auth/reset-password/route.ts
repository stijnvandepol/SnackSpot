import { type NextRequest } from 'next/server'
import { ResetPasswordSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { hashPassword, hashResetToken, buildClearCookie } from '@/lib/auth'
import { sendPasswordChangedEmail } from '@/lib/email'
import { ok, err, parseBody, serverError, isResponse, requireSameOrigin, withNoStore } from '@/lib/api-helpers'
import { rateLimitIP, getClientIP } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const sameOrigin = requireSameOrigin(req)
  if (sameOrigin) return sameOrigin

  // Rate limit: 10 attempts per 15 minutes per IP
  const ip = getClientIP(req)
  const rl = await rateLimitIP(ip, 'reset-password', 10, 900)
  if (!rl.allowed) {
    return err('Too many requests – try again later', 429)
  }

  const body = await parseBody(req, ResetPasswordSchema)
  if (isResponse(body)) return body

  try {
    const tokenHash = hashResetToken(body.token)

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    })

    // Reject if token is unknown, expired, or already used.
    // Return a generic error to avoid leaking information.
    if (!record || record.usedAt !== null || record.expiresAt < new Date()) {
      return err('This reset link is invalid or has expired.', 400)
    }

    const newPasswordHash = await hashPassword(body.password)

    // Atomically: mark token used, update password, delete all refresh tokens (sign out everywhere)
    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: newPasswordHash },
      }),
      prisma.refreshToken.deleteMany({
        where: { userId: record.userId },
      }),
    ])

    // Fetch email and username for the confirmation mail — done outside the transaction
    // so a mail failure does not roll back the password change.
    const user = await prisma.user.findUnique({
      where: { id: record.userId },
      select: { email: true, username: true },
    })

    if (user) {
      try {
        await sendPasswordChangedEmail(user.email, user.username)
      } catch {
        // Swallowed — confirmation mail failure must not affect the response
      }
    }

    // Clear the refresh-token cookie in the response (session is already invalidated in DB)
    const response = withNoStore(ok({ message: 'Password has been reset successfully.' }))
    response.headers.set('Set-Cookie', buildClearCookie())
    return response
  } catch (e) {
    return serverError('reset-password', e)
  }
}
