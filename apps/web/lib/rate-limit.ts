import { redis } from './redis'
import { env } from './env'
import { SLIDING_WINDOW_LUA, type RateLimitResult } from '@snackspot/shared'

/**
 * Sliding-window rate limiter backed by Redis sorted sets.
 * Blocked requests are NOT counted against the limit — only allowed requests
 * consume a slot, preventing attackers from holding legitimate callers over
 * the threshold via a flood of rejected requests.
 *
 * @param key           unique redis key
 * @param limit         max requests allowed in window
 * @param windowSeconds window size in seconds
 */
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

export function rateLimitIP(ip: string, action: string, limit: number, windowSeconds: number) {
  return rateLimit(`rl:ip:${action}:${ip}`, limit, windowSeconds)
}

export function rateLimitUser(userId: string, action: string, limit: number, windowSeconds: number) {
  return rateLimit(`rl:user:${action}:${userId}`, limit, windowSeconds)
}

// ─── Login failure counters ──────────────────────────────────────────────────
// Simple INCR-based counters (not sliding-window). Used to decide when to
// require a CAPTCHA challenge. Each counter expires after the login window.

const LOGIN_FAIL_TTL = 900 // 15 minutes

function loginFailIPKey(ip: string): string {
  return `login:fail:ip:${ip}`
}

function loginFailEmailKey(email: string): string {
  return `login:fail:email:${email.toLowerCase()}`
}

export async function incrementLoginFailures(ip: string, email: string): Promise<void> {
  const pipeline = redis.pipeline()
  pipeline.incr(loginFailIPKey(ip))
  pipeline.incr(loginFailEmailKey(email))
  // Pipeline results are [[err, value], ...]. INCR returns 1 only when it
  // creates a brand-new key — that's the signal to set TTL. We avoid touching
  // the TTL of existing keys so repeated failures don't keep extending the window.
  const results = await pipeline.exec() as Array<[Error | null, number]> | null
  const ipNew = results?.[0]?.[1] === 1
  const emailNew = results?.[1]?.[1] === 1
  const expirePipeline = redis.pipeline()
  if (ipNew) expirePipeline.expire(loginFailIPKey(ip), LOGIN_FAIL_TTL)
  if (emailNew) expirePipeline.expire(loginFailEmailKey(email), LOGIN_FAIL_TTL)
  if (ipNew || emailNew) await expirePipeline.exec()
}

export async function resetLoginFailures(ip: string, email: string): Promise<void> {
  await redis.del(loginFailIPKey(ip), loginFailEmailKey(email))
}

export async function getLoginFailureCount(
  ip: string,
  email: string,
): Promise<{ ip: number; email: number }> {
  if (!email) return { ip: Number((await redis.get(loginFailIPKey(ip))) ?? 0), email: 0 }
  const [ipCount, emailCount] = await redis.mget(loginFailIPKey(ip), loginFailEmailKey(email))
  return {
    ip: Number(ipCount ?? 0),
    email: Number(emailCount ?? 0),
  }
}

/** Extract client IP. Trust proxy headers only when explicitly configured. */
export function getClientIP(req: Request): string {
  if (env.TRUST_PROXY) {
    const xRealIp = req.headers.get('x-real-ip')?.trim()
    if (xRealIp) return xRealIp

    const xff = req.headers.get('x-forwarded-for') ?? ''
    const firstForwarded = xff.split(',')[0]?.trim()
    if (firstForwarded) return firstForwarded
  }
  return '127.0.0.1'
}
