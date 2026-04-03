import { type NextRequest } from 'next/server'
import { UpdateMeProfileSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { ok, err, parseBody, requireAuth, serverError, isResponse, withNoStore } from '@/lib/api-helpers'
import { rateLimitUser, getClientIP, rateLimitIP } from '@/lib/rate-limit'

const USERNAME_CHANGE_COOLDOWN_DAYS = 30
const USERNAME_CHANGE_COOLDOWN_MS = USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000

type UpdateMeProfileInput = {
  username?: string
  bio?: string
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: {
        id: true,
        email: true,
        username: true,
        bio: true,
        avatarKey: true,
        usernameChangedAt: true,
        role: true,
        isVerified: true,
      },
    })

    if (!user) return err('User not found', 404)

    const nextUsernameChangeAt = user.usernameChangedAt
      ? new Date(user.usernameChangedAt.getTime() + USERNAME_CHANGE_COOLDOWN_MS)
      : null

    return withNoStore(ok({
      ...user,
      usernameCanChangeNow: !nextUsernameChangeAt || nextUsernameChangeAt <= new Date(),
      nextUsernameChangeAt,
    }))
  } catch (e) {
    return serverError('me/profile GET', e)
  }
}

export async function PATCH(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const ip = getClientIP(req)
  const [userRl, ipRl] = await Promise.all([
    rateLimitUser(auth.sub, 'profile-patch', 10, 60),
    rateLimitIP(ip, 'profile-patch', 20, 60),
  ])
  if (!userRl.allowed || !ipRl.allowed) return err('Too many requests', 429)

  const body = await parseBody<UpdateMeProfileInput>(req, UpdateMeProfileSchema)
  if (isResponse(body)) return body

  try {
    const current = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: { id: true, username: true, usernameChangedAt: true },
    })

    if (!current) return err('User not found', 404)

    let usernameChangeRequested = false
    if (body.username !== undefined) {
      const nextUsername = body.username.trim()
      if (nextUsername.length === 0) {
        return err('Username cannot be empty', 422)
      }
      if (nextUsername !== current.username) {
        usernameChangeRequested = true
        if (current.usernameChangedAt) {
          const nextAllowedAt = new Date(current.usernameChangedAt.getTime() + USERNAME_CHANGE_COOLDOWN_MS)
          if (nextAllowedAt > new Date()) {
            return err(`Username can only be changed once every ${USERNAME_CHANGE_COOLDOWN_DAYS} days`, 429)
          }
        }
      }
    }

    const updated = await prisma.user.update({
      where: { id: auth.sub },
      data: {
        ...(body.username !== undefined ? { username: body.username.trim() } : {}),
        ...(body.bio !== undefined ? { bio: body.bio.trim() || null } : {}),
        ...(usernameChangeRequested ? { usernameChangedAt: new Date() } : {}),
      },
      select: {
        id: true,
        email: true,
        username: true,
        bio: true,
        avatarKey: true,
        usernameChangedAt: true,
        role: true,
        isVerified: true,
      },
    })

    const nextUsernameChangeAt = updated.usernameChangedAt
      ? new Date(updated.usernameChangedAt.getTime() + USERNAME_CHANGE_COOLDOWN_MS)
      : null

    return withNoStore(ok({
      ...updated,
      usernameCanChangeNow: !nextUsernameChangeAt || nextUsernameChangeAt <= new Date(),
      nextUsernameChangeAt,
    }))
  } catch (e: unknown) {
    const code =
      e &&
      typeof e === 'object' &&
      'code' in e &&
      typeof (e as { code?: unknown }).code === 'string'
        ? (e as { code: string }).code
        : null

    if (code === 'P2002') {
      return err('Username is already taken', 409)
    }

    return serverError('me/profile PATCH', e)
  }
}
