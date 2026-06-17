import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendMarketingEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { parseBody, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimit } from '@/lib/rate-limit'

// Resend allows ~10 req/s; pace sends so a broadcast can't trip the provider.
const SEND_THROTTLE_MS = 120

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
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin

  // A broadcast hits the entire user base; cap how often any admin can fire one.
  const rl = await rateLimit(`marketing-email:${admin.sub}`, 5, 3600)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Te veel mailings verstuurd. Probeer het later opnieuw.' },
      { status: 429 },
    )
  }

  const body = await parseBody(req, BodySchema)
  if (isResponse(body)) return body

  try {
    let users: { email: string; username: string }[]

    if (body.recipients === 'all') {
      users = await db.user.findMany({
        where: { bannedAt: null },
        select: { email: true, username: true },
        orderBy: { createdAt: 'asc' },
      })
    } else {
      users = await db.user.findMany({
        where: { username: { in: body.recipients.usernames }, bannedAt: null },
        select: { email: true, username: true },
      })
    }

    let sent = 0
    let failed = 0

    for (const user of users) {
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
      } catch (err) {
        // Don't abort the broadcast on one bad recipient, but don't hide the
        // cause either — log it so failures are diagnosable server-side.
        logger.error({ err }, 'marketing email send failed')
        failed++
      }
      // Pace the loop so a large recipient list stays under the provider rate.
      if (users.length > 1) await new Promise((resolve) => setTimeout(resolve, SEND_THROTTLE_MS))
    }

    return NextResponse.json({ sent, failed, total: users.length })
  } catch (e) {
    return serverError('marketing-email POST', e)
  }
}
