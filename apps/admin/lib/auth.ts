import { type NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { env } from './env'
import type { Role } from '@prisma/client'

export interface AdminTokenPayload {
  sub: string      // userId
  email: string
  username: string
  role: Role
  iat?: number
  exp?: number
}

const JWT_ISSUER = 'snackspot-admin'
const JWT_AUDIENCE = 'snackspot-admin'
const ADMIN_SESSION_HOURS = 8
export const ADMIN_SESSION_COOKIE = 'snackspot_admin_at'

export function verifyAccessToken(token: string): AdminTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as AdminTokenPayload
}

export function signAdminAccessToken(payload: Omit<AdminTokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: `${ADMIN_SESSION_HOURS}h`,
  })
}

function shouldUseSecureCookie(): boolean {
  if (typeof env.AUTH_COOKIE_SECURE === 'boolean') return env.AUTH_COOKIE_SECURE
  return env.NODE_ENV === 'production'
}

export function buildSetAdminCookie(token: string): string {
  const secure = shouldUseSecureCookie()
  return [
    `${ADMIN_SESSION_COOKIE}=${token}`,
    `Max-Age=${ADMIN_SESSION_HOURS * 60 * 60}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}

export function buildClearAdminCookie(): string {
  const secure = shouldUseSecureCookie()
  return [
    `${ADMIN_SESSION_COOKIE}=`,
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

export function extractToken(req: NextRequest): string | null {
  const bearer = extractBearerToken(req.headers.get('authorization'))
  if (bearer) return bearer
  return req.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? null
}

export function requireAdmin(req: NextRequest): AdminTokenPayload | Response {
  const token = extractToken(req)
  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: AdminTokenPayload
  try {
    payload = verifyAccessToken(token)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (payload.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  return payload
}
