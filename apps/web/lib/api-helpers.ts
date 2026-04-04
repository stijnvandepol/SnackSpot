import type { NextRequest } from 'next/server'
import { verifyAccessToken, type AccessTokenPayload } from './auth'
import type { Role } from '@prisma/client'
import { logger } from './logger'
import { env } from './env'

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

export function withPublicCache(res: Response, maxAgeSeconds = 15, staleWhileRevalidateSeconds = 60): Response {
  res.headers.set('Cache-Control', `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`)
  res.headers.set('Vary', 'Accept')
  return res
}

export function withNoStore(res: Response): Response {
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export function err(message: string, status: number, details?: unknown): Response {
  return Response.json({ error: message, ...(details ? { details } : {}) }, { status })
}

export function validationError(details: unknown): Response {
  return err('Validation error', 422, details)
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
    const contentLengthRaw = req.headers.get('content-length')
    if (contentLengthRaw) {
      const contentLength = Number.parseInt(contentLengthRaw, 10)
      if (Number.isFinite(contentLength) && contentLength > env.MAX_JSON_BODY_BYTES) {
        return err(`Request body too large - max ${env.MAX_JSON_BODY_BYTES} bytes`, 413)
      }
    }

    const text = await req.text()
    if (text.length > env.MAX_JSON_BODY_BYTES) {
      return err(`Request body too large - max ${env.MAX_JSON_BODY_BYTES} bytes`, 413)
    }
    raw = JSON.parse(text)
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

export function requireSameOrigin(req: NextRequest): Response | null {
  const origin = req.headers.get('origin')
  if (!origin) return null

  let originUrl: URL
  try {
    originUrl = new URL(origin)
  } catch {
    return err('Invalid Origin header', 400)
  }

  // Only trust x-forwarded-host when running behind a known proxy (TRUST_PROXY=true).
  // Unconditionally trusting it lets an attacker spoof the header to bypass this check.
  const host = (env.TRUST_PROXY ? req.headers.get('x-forwarded-host') : null) ?? req.headers.get('host')
  if (!host) return err('Missing host header', 400)

  const allowed = originUrl.host === host
  if (!allowed) return err('Cross-site request blocked', 403)
  return null
}

/** Type guard: is the value a Response (i.e., an error early-return)? */
export function isResponse(v: unknown): v is Response {
  return v instanceof Response
}
