import { type NextRequest } from 'next/server'
import { ForgotPasswordSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { generateResetToken, hashResetToken, resetTokenExpiresAt } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/email'
import { ok, err, parseBody, serverError, isResponse, requireSameOrigin, withNoStore } from '@/lib/api-helpers'
import { rateLimitIP, rateLimit, getClientIP } from '@/lib/rate-limit'
import { env } from '@/lib/env'

// Response body factory — Response bodies are ReadableStreams consumed exactly once.
// A module-level Response constant would return a drained stream on the second request.
function genericOk() {
  return withNoStore(ok({ message: 'If an account with that email exists, a reset link has been sent.' }))
}

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
    return genericOk()
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: emailKey },
      select: { id: true, username: true, email: true },
    })

    // Always return the same response regardless of whether the user was found
    if (!user) {
      return genericOk()
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

    // Await sending to avoid request teardown racing the mail call in serverless runtimes.
    // Delivery errors are still swallowed to keep the response shape generic.
    try {
      await sendPasswordResetEmail(user.email, resetUrl)
    } catch (e: unknown) {
      console.error('[forgot-password] email send failed:', e instanceof Error ? e.message : String(e))
    }

    return genericOk()
  } catch (e) {
    return serverError('forgot-password', e)
  }
}
