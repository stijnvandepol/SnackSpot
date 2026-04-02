import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, requireAuth, serverError, isResponse, parseBody } from '@/lib/api-helpers'

const PreferencesSchema = z.object({
  emailOnLike: z.boolean().optional(),
  emailOnComment: z.boolean().optional(),
  emailOnMention: z.boolean().optional(),
  emailOnBadge: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  try {
    let preferences = await prisma.notificationPreferences.findUnique({
      where: { userId: auth.sub },
    })

    // Create default preferences if they don't exist
    if (!preferences) {
      preferences = await prisma.notificationPreferences.create({
        data: { userId: auth.sub },
      })
    }

    return ok({ data: preferences })
  } catch (e) {
    return serverError('notification-preferences/get', e)
  }
}

export async function PATCH(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const body = await parseBody(req, PreferencesSchema)
  if (isResponse(body)) return body

  try {
    const preferences = await prisma.notificationPreferences.upsert({
      where: { userId: auth.sub },
      update: body,
      create: {
        userId: auth.sub,
        ...body,
      },
    })

    return ok({ data: preferences })
  } catch (e) {
    return serverError('notification-preferences/update', e)
  }
}
