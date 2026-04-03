import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendMarketingEmail } from '@/lib/email'

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
  if (admin instanceof Response) return admin

  let body: z.infer<typeof BodySchema>
  try {
    const json = await req.json()
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 422 })
    }
    body = parsed.data
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

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
      } catch {
        failed++
      }
    }

    return NextResponse.json({ sent, failed, total: users.length })
  } catch (e) {
    console.error('marketing-email error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
