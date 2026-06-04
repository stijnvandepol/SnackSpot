import type { NextRequest } from 'next/server'
import { logger } from './logger'

// Mirrors the error/validation/parsing helpers of apps/web/lib/api-helpers.ts,
// adapted to the admin app. Deliberately NO success envelope helper: admin
// routes return bare, route-specific shapes (e.g. { users, pagination }, { place })
// that the admin frontend reads directly, so wrapping them in { data } would break it.
// User-facing messages stay in Dutch to match the (Dutch) admin UI.

// Admin has no MAX_JSON_BODY_BYTES env var; use the same default as web.
const MAX_JSON_BODY_BYTES = 256 * 1024

type ZodLike<T> = {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: { flatten(): unknown } }
}

// ─── Response builders ───────────────────────────────────────────────────────

/** Error response. Shape matches the admin frontend's expectation: { error }. */
export function err(message: string, status: number, details?: unknown): Response {
  return Response.json({ error: message, ...(details ? { details } : {}) }, { status })
}

export function validationError(details: unknown): Response {
  return err('Validatiefout', 422, details)
}

/** Log the (unexpected) error server-side and return a generic 500.
 *  Replaces admin's previous silent `catch { return {error} 500 }` blocks. */
export function serverError(context: string, error: unknown): Response {
  logger.error({ err: error, context }, 'Internal server error')
  return err('Er is een interne serverfout opgetreden', 500)
}

// ─── Prisma error mapping ────────────────────────────────────────────────────

export function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === code
}

/** Maps common Prisma errors to client responses, centralising the detection
 *  that was previously duplicated across routes. Returns null when the error is
 *  not a recognised Prisma case, so the caller can fall through to serverError().
 *  Messages are overridable so each route can name its entity in Dutch. */
export function mapPrismaError(
  error: unknown,
  messages?: { notFound?: string; conflict?: string },
): Response | null {
  if (hasPrismaCode(error, 'P2025')) return err(messages?.notFound ?? 'Niet gevonden', 404)
  if (hasPrismaCode(error, 'P2002')) return err(messages?.conflict ?? 'Bestaat al', 409)
  return null
}

// ─── Request parsing ─────────────────────────────────────────────────────────

/** Parse and validate a JSON body with a Zod schema. Returns the parsed data or
 *  an error Response. Replaces unsafe `(await req.json()) as T` casts. */
export async function parseBody<T>(req: NextRequest, schema: ZodLike<T>): Promise<T | Response> {
  let raw: unknown
  try {
    const contentLengthRaw = req.headers.get('content-length')
    if (contentLengthRaw) {
      const contentLength = Number.parseInt(contentLengthRaw, 10)
      if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
        return err(`Verzoek te groot - max ${MAX_JSON_BODY_BYTES} bytes`, 413)
      }
    }
    const text = await req.text()
    if (text.length > MAX_JSON_BODY_BYTES) {
      return err(`Verzoek te groot - max ${MAX_JSON_BODY_BYTES} bytes`, 413)
    }
    raw = JSON.parse(text)
  } catch {
    return err('Ongeldige JSON', 400)
  }

  const result = schema.safeParse(raw)
  if (!result.success) return validationError(result.error.flatten())
  return result.data
}

/** Parse and validate URL search params with a Zod schema. */
export function parseQuery<T>(req: NextRequest, schema: ZodLike<T>): T | Response {
  const raw = Object.fromEntries(req.nextUrl.searchParams)
  const result = schema.safeParse(raw)
  if (!result.success) return validationError(result.error.flatten())
  return result.data
}

// ─── Misc ────────────────────────────────────────────────────────────────────

/** Type guard for early-return error Responses (e.g. from requireAdmin/parseBody). */
export function isResponse(v: unknown): v is Response {
  return v instanceof Response
}
