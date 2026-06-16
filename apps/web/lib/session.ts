import type { Role } from '@prisma/client'
import { prisma } from './db'
import {
  signAccessToken,
  generateRefreshToken,
  generateTokenFamily,
  hashRefreshToken,
  refreshTokenExpiresAt,
  buildSetCookie,
} from './auth'

export interface SessionUser {
  id: string
  email: string
  username: string
  role: Role
}

/** Mint a fresh login session: new access token + new refresh-token family.
 *  Used by register, password login, and Google SSO so all three share
 *  identical session semantics. (Refresh rotation lives in its own route.) */
export async function issueSession(user: SessionUser): Promise<{ accessToken: string; setCookie: string }> {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  })
  const rawRefresh = generateRefreshToken()
  const expiresAt = refreshTokenExpiresAt()
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(rawRefresh),
      family: generateTokenFamily(),
      expiresAt,
    },
  })
  return { accessToken, setCookie: buildSetCookie(rawRefresh, expiresAt) }
}
