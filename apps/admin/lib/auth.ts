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

export function verifyAccessToken(token: string): AdminTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as AdminTokenPayload
}

export function extractToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

export async function requireAdmin(authHeader: string | null) {
  const token = extractToken(authHeader)
  if (!token) throw new Error('No authentication token')
  
  const payload = verifyAccessToken(token)
  if (payload.role !== 'ADMIN') {
    throw new Error('Admin access required')
  }
  
  return payload
}
