import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { ok, err, parseBody, requireAuth, serverError, isResponse, withNoStore } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'

const SubscribeSchema = z.object({
  endpoint: z.string().url().max(1024),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
})

const UnsubscribeSchema = z.object({
  endpoint: z.string().url().max(1024),
})

// GET /api/v1/push — VAPID public key + whether this user has subscriptions.
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  try {
    const count = await prisma.pushSubscription.count({ where: { userId: auth.sub } })
    return withNoStore(
      ok({
        publicKey: env.VAPID_PUBLIC_KEY ?? null,
        enabled: Boolean(env.VAPID_PUBLIC_KEY),
        subscriptionCount: count,
      }),
    )
  } catch (e) {
    return serverError('push GET', e)
  }
}

// POST /api/v1/push — register (or re-claim) a browser push subscription.
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  if (!env.VAPID_PUBLIC_KEY) return err('Push is not configured on this server', 503)

  const body = await parseBody(req, SubscribeSchema)
  if (isResponse(body)) return body

  try {
    const rl = await rateLimitUser(auth.sub, 'push_subscribe', 20, 3600)
    if (!rl.allowed) return err('Too many subscription attempts', 429)

    // Upsert by endpoint: a browser re-subscribing (or a device changing
    // accounts) re-claims the endpoint for the current user.
    await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        userId: auth.sub,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: req.headers.get('user-agent')?.slice(0, 255) ?? null,
      },
      update: {
        userId: auth.sub,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
    })

    return ok({ subscribed: true })
  } catch (e) {
    return serverError('push POST', e)
  }
}

// DELETE /api/v1/push — remove a subscription (own endpoints only).
export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const body = await parseBody(req, UnsubscribeSchema)
  if (isResponse(body)) return body

  try {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: body.endpoint, userId: auth.sub },
    })
    return ok({ subscribed: false })
  } catch (e) {
    return serverError('push DELETE', e)
  }
}
