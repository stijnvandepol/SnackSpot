import { type NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { env } from './env'
import { db } from './db'
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

/** Short-lived access token — refresh rotation provides session continuity. */
const ACCESS_TOKEN_MINUTES = 30
const REFRESH_TOKEN_DAYS = 7

export const ADMIN_SESSION_COOKIE = 'snackspot_admin_at'
export const ADMIN_REFRESH_COOKIE = 'snackspot_admin_rt'

// ── Access token ─────────────────────────────────────────────────

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
    expiresIn: `${ACCESS_TOKEN_MINUTES}m`,
  })
}

// ── Refresh token ────────────────────────────────────────────────

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex')
}

export async function storeRefreshToken(userId: string, rawToken: string, family: string): Promise<void> {
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000)
  await db.refreshToken.create({
    data: {
      tokenHash: hashToken(rawToken),
      userId,
      family,
      expiresAt,
    },
  })
}

/**
 * Rotate a refresh token: mark old as used, create new one.
 * Returns null if the token is invalid/expired/reused (theft detection).
 */
export async function rotateRefreshToken(
  rawToken: string,
): Promise<{ newRawToken: string; payload: AdminTokenPayload } | null> {
  const tokenHash = hashToken(rawToken)

  const existing = await db.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, username: true, role: true } } },
  })

  if (!existing || existing.expiresAt < new Date()) return null
  if (existing.user.role !== 'ADMIN') return null

  // Theft detection: token already used → invalidate entire family
  if (existing.usedAt) {
    const usedAgo = Date.now() - existing.usedAt.getTime()
    // Grace period for concurrent requests (5 minutes)
    if (usedAgo > 5 * 60 * 1000) {
      await db.refreshToken.deleteMany({ where: { family: existing.family } })
      return null
    }
  }

  // Mark current token as used
  await db.refreshToken.update({
    where: { tokenHash },
    data: { usedAt: new Date() },
  })

  // Issue new refresh token in same family
  const newRawToken = generateRefreshToken()
  await storeRefreshToken(existing.userId, newRawToken, existing.family)

  const payload: AdminTokenPayload = {
    sub: existing.user.id,
    email: existing.user.email,
    username: existing.user.username,
    role: existing.user.role,
  }

  return { newRawToken, payload }
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken)
  await db.refreshToken.deleteMany({ where: { tokenHash } }).catch(() => {})
}

// ── Cookies ──────────────────────────────────────────────────────

function shouldUseSecureCookie(): boolean {
  if (typeof env.AUTH_COOKIE_SECURE === 'boolean') return env.AUTH_COOKIE_SECURE
  return env.NODE_ENV === 'production'
}

export function buildSetAdminCookie(token: string): string {
  const secure = shouldUseSecureCookie()
  return [
    `${ADMIN_SESSION_COOKIE}=${token}`,
    `Max-Age=${ACCESS_TOKEN_MINUTES * 60}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}

export function buildSetRefreshCookie(token: string): string {
  const secure = shouldUseSecureCookie()
  return [
    `${ADMIN_REFRESH_COOKIE}=${token}`,
    `Max-Age=${REFRESH_TOKEN_DAYS * 24 * 60 * 60}`,
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

export function buildClearRefreshCookie(): string {
  const secure = shouldUseSecureCookie()
  return [
    `${ADMIN_REFRESH_COOKIE}=`,
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}

// ── Auth extraction ──────────────────────────────────────────────

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
