import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, requireAuth, serverError, isResponse, parseBody } from '@/lib/api-helpers'

const PushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
})

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const body = await parseBody(req, PushSubscriptionSchema)
  if (isResponse(body)) return body

  try {
    const userAgent = req.headers.get('user-agent') ?? undefined

    // Delete existing subscription with same endpoint
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: body.endpoint },
    })

    const subscription = await prisma.pushSubscription.create({
      data: {
        userId: auth.sub,
        endpoint: body.endpoint,
        p256dhKey: body.keys.p256dh,
        authKey: body.keys.auth,
        userAgent,
      },
    })

    return ok({ data: subscription })
  } catch (e) {
    return serverError('push-subscription/create', e)
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const body = await parseBody(req, z.object({ endpoint: z.string() }))
  if (isResponse(body)) return body

  try {
    await prisma.pushSubscription.deleteMany({
      where: {
        userId: auth.sub,
        endpoint: body.endpoint,
      },
    })

    return ok({ data: { success: true } })
  } catch (e) {
    return serverError('push-subscription/delete', e)
  }
}
