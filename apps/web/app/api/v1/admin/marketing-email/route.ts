import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole, requireSameOrigin, parseBody, ok, err, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'
import { prisma } from '@/lib/db'
import { sendMarketingEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

const BodySchema = z.object({
  subject:      z.string().min(1).max(200),
  eyebrow:      z.string().min(1).max(80),
  title:        z.string().min(1).max(200),
  intro:        z.string().min(1).max(2000),
  calloutTitle: z.string().min(1).max(200),
  calloutBody:  z.string().min(1).max(1000),
  action: z.object({ label: z.string().min(1).max(80), href: z.string().url() }).optional(),
  recipients: z.union([
    z.literal('all'),
    z.object({ usernames: z.array(z.string().min(1)).min(1).max(200) }),
  ]),
})

export async function POST(req: NextRequest) {
  const sameOrigin = requireSameOrigin(req)
  if (isResponse(sameOrigin)) return sameOrigin

  const auth = requireRole(req, 'ADMIN')
  if (isResponse(auth)) return auth

  const rl = await rateLimitUser(auth.sub, 'marketing_email', 5, 3600)
  if (!rl.allowed) return err('Rate limit exceeded — max 5 sends per hour', 429)

  const body = await parseBody(req, BodySchema)
  if (isResponse(body)) return body

  try {
    let users: { email: string; username: string }[]

    if (body.recipients === 'all') {
      users = await prisma.user.findMany({
        where: { bannedAt: null },
        select: { email: true, username: true },
        orderBy: { createdAt: 'asc' },
      })
    } else {
      users = await prisma.user.findMany({
        where: { username: { in: body.recipients.usernames }, bannedAt: null },
        select: { email: true, username: true },
      })
    }

    let sent = 0
    let failed = 0

    // Resend enforces a 5 req/s rate limit. sendEmailWithFallback may make up to
    // 2 API calls per recipient, so cap throughput at ~2.5 emails/sec (400 ms gap).
    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      if (i > 0) await new Promise((r) => setTimeout(r, 400))
      try {
        await sendMarketingEmail(
          user.email,
          body.subject,
          body.eyebrow,
          body.title,
          body.intro,
          body.calloutTitle,
          body.calloutBody,
          body.action,
        )
        sent++
      } catch (emailErr) {
        logger.error({ err: emailErr, username: user.username }, 'Marketing email failed for user')
        failed++
      }
    }

    logger.info({ adminId: auth.sub, sent, failed, recipients: body.recipients }, 'Marketing email batch sent')
    return ok({ sent, failed, total: users.length })
  } catch (error) {
    return serverError('POST /api/v1/admin/marketing-email', error)
  }
}
