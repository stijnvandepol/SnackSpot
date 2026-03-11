import { type NextRequest } from 'next/server'
import { ForgotPasswordSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { generateResetToken, hashResetToken, resetTokenExpiresAt } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/email'
import { ok, err, parseBody, serverError, isResponse, requireSameOrigin, withNoStore } from '@/lib/api-helpers'
import { rateLimitIP, rateLimit, getClientIP } from '@/lib/rate-limit'
import { env } from '@/lib/env'

// Generic response sent regardless of whether the email exists (prevents account enumeration).
const GENERIC_OK = ok({ message: 'If an account with that email exists, a reset link has been sent.' })

export async function POST(req: NextRequest) {
  const sameOrigin = requireSameOrigin(req)
  if (sameOrigin) return sameOrigin

  // Rate limit: 5 requests per 15 minutes per IP
  const ip = getClientIP(req)
  const ipRl = await rateLimitIP(ip, 'forgot-password', 5, 900)
  if (!ipRl.allowed) {
    return err('Too many requests – try again later', 429)
  }

  const body = await parseBody(req, ForgotPasswordSchema)
  if (isResponse(body)) return body

  // Rate limit: 3 requests per hour per email address (normalised to lowercase)
  const emailKey = body.email.toLowerCase()
  const emailRl = await rateLimit(`rl:email:forgot-password:${emailKey}`, 3, 3600)
  if (!emailRl.allowed) {
    // Still return a generic response — don't reveal rate-limiting by email
    return withNoStore(GENERIC_OK)
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: emailKey },
      select: { id: true, username: true, email: true },
    })

    // Always return the same response regardless of whether the user was found
    if (!user) {
      return withNoStore(GENERIC_OK)
    }

    // Invalidate any existing (unused) tokens for this user before issuing a new one
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    })

    const rawToken = generateResetToken()
    const tokenHash = hashResetToken(rawToken)
    const expiresAt = resetTokenExpiresAt()

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    })

    // Build the reset URL — never embed the user ID or email directly
    const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${rawToken}`

    // Fire-and-forget; a delivery failure should not reveal user existence via the error shape
    sendPasswordResetEmail(user.email, resetUrl).catch(() => {
      // Intentionally swallowed — log silently without leaking PII
    })

    return withNoStore(GENERIC_OK)
  } catch (e) {
    return serverError('forgot-password', e)
  }
}
