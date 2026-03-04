import type { NextRequest } from 'next/server'
import { verifyAccessToken, type AccessTokenPayload } from './auth'
import type { Role } from '@prisma/client'
import { logger } from './logger'

// ─── Standard response builders ──────────────────────────────────────────────

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status })
}

export function created<T>(data: T): Response {
  return Response.json({ data }, { status: 201 })
}

export function noContent(): Response {
  return new Response(null, { status: 204 })
}

export function err(message: string, status: number, details?: unknown): Response {
  return Response.json({ error: message, ...(details ? { details } : {}) }, { status })
}

export function validationError(details: unknown): Response {
  return err('Validation error', 422, details)
}

export function rateLimited(): Response {
  return err('Too many requests', 429)
}

// ─── Auth extraction helpers ─────────────────────────────────────────────────

export function getAuthPayload(req: NextRequest): AccessTokenPayload | null {
  const header = req.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  try {
    return verifyAccessToken(header.slice(7))
  } catch {
    return null
  }
}

/** Require authenticated user; returns payload or a 401 Response */
export function requireAuth(
  req: NextRequest,
): AccessTokenPayload | Response {
  const payload = getAuthPayload(req)
  if (!payload) return err('Unauthorized', 401)
  return payload
}

/** Require authenticated user with minimum role */
export function requireRole(
  req: NextRequest,
  minRole: Role,
): AccessTokenPayload | Response {
  const payload = getAuthPayload(req)
  if (!payload) return err('Unauthorized', 401)

  const hierarchy: Record<Role, number> = { USER: 0, MODERATOR: 1, ADMIN: 2 }
  if (hierarchy[payload.role] < hierarchy[minRole]) {
    return err('Forbidden', 403)
  }
  return payload
}

/** Parse and validate request body with Zod schema */
export async function parseBody<T>(
  req: NextRequest,
  schema: { safeParse(data: unknown): { success: true; data: T } | { success: false; error: { flatten(): unknown } } },
): Promise<T | Response> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    return validationError(result.error.flatten())
  }
  return result.data
}

/** Parse and validate URL search params with Zod schema */
export function parseQuery<T>(
  req: NextRequest,
  schema: { safeParse(data: unknown): { success: true; data: T } | { success: false; error: { flatten(): unknown } } },
): T | Response {
  const raw = Object.fromEntries(req.nextUrl.searchParams)
  const result = schema.safeParse(raw)
  if (!result.success) {
    return validationError(result.error.flatten())
  }
  return result.data
}

/** Log and return internal server error */
export function serverError(context: string, error: unknown): Response {
  logger.error({ err: error, context }, 'Internal server error')
  return err('Internal server error', 500)
}

/** Type guard: is the value a Response (i.e., an error early-return)? */
export function isResponse(v: unknown): v is Response {
  return v instanceof Response
}
