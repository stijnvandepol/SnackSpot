import jwt from 'jsonwebtoken'
import argon2 from 'argon2'
import { createHash, randomBytes } from 'crypto'
import { env } from './env'
import type { Role } from '@prisma/client'

export interface AccessTokenPayload {
  sub: string      // userId
  email: string
  username: string
  role: Role
  iat?: number
  exp?: number
}

const JWT_ISSUER = 'snackspot'
const JWT_AUDIENCE = 'snackspot-users'

// ─── Argon2id password hashing ───────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 4,
  })
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password)
}

// ─── JWT access token ────────────────────────────────────────────────────────

export function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): string {
  const expiresIn = env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn']
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn,
  })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as AccessTokenPayload
}

// ─── Refresh token ───────────────────────────────────────────────────────────

export function generateRefreshToken(): string {
  return randomBytes(40).toString('hex')
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function refreshTokenExpiresAt(): Date {
  return new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000)
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

export const REFRESH_COOKIE = 'snackspot_rt'

export function buildSetCookie(token: string, expires: Date): string {
  const isProd = env.NODE_ENV === 'production'
  return [
    `${REFRESH_COOKIE}=${token}`,
    `Expires=${expires.toUTCString()}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    ...(isProd ? ['Secure'] : []),
  ].join('; ')
}

export function buildClearCookie(): string {
  return [
    `${REFRESH_COOKIE}=`,
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ].join('; ')
}
