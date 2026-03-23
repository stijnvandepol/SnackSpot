import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashVerificationToken } from '@/lib/auth'
import { ok, err, parseBody, serverError, isResponse, requireSameOrigin, withNoStore } from '@/lib/api-helpers'
import { rateLimitIP, getClientIP } from '@/lib/rate-limit'

const VerifyEmailSchema = z.object({
  token: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const sameOrigin = requireSameOrigin(req)
  if (sameOrigin) return sameOrigin

  // Rate limit: 10 attempts per 15 minutes per IP
  const ip = getClientIP(req)
  const rl = await rateLimitIP(ip, 'verify-email', 10, 900)
  if (!rl.allowed) {
    return err('Too many requests – try again later', 429)
  }

  const body = await parseBody(req, VerifyEmailSchema)
  if (isResponse(body)) return body

  try {
    const tokenHash = hashVerificationToken(body.token)

    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    })

    if (!record || record.usedAt !== null || record.expiresAt < new Date()) {
      return err('This verification link is invalid or has expired.', 400)
    }

    await prisma.$transaction([
      prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ])

    return withNoStore(ok({ message: 'Email address verified successfully.' }))
  } catch (e) {
    return serverError('verify-email', e)
  }
}
