import { redis } from './redis'
import { SLIDING_WINDOW_LUA, type RateLimitResult } from '@snackspot/shared'

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now()
  const member = `${now}-${Math.random().toString(36).slice(2)}`

  const result = await redis.eval(
    SLIDING_WINDOW_LUA,
    1,
    key,
    String(now),
    String(windowSeconds * 1000),
    String(limit),
    member,
    String(windowSeconds),
  ) as [number, number]

  const count = result[0]
  const allowed = result[1] === 1

  return {
    allowed,
    remaining: Math.max(0, limit - count),
    resetInSeconds: windowSeconds,
  }
}

export function getClientIp(headers: Headers): string {
  const xRealIp = headers.get('x-real-ip')?.trim()
  if (xRealIp) return xRealIp

  const xForwardedFor = headers.get('x-forwarded-for') ?? ''
  const firstForwarded = xForwardedFor.split(',')[0]?.trim()
  if (firstForwarded) return firstForwarded

  return '127.0.0.1'
}
