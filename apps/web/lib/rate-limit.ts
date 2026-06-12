import { redis } from './redis'
import { env } from './env'
import { logger } from './logger'
import { SLIDING_WINDOW_LUA, type RateLimitResult } from '@snackspot/shared'

// Rate limiting is a protection layer, not a correctness gate. If Redis is
// briefly unavailable we fail OPEN (allow the request) and log loudly, rather
// than 500-ing every rate-limited endpoint — a Redis blip must not take the
// site, and especially auth, offline. The window of reduced protection is
// short, and per-attempt cost (Argon2id on the auth paths) caps the damage.
//
// The shared ioredis client runs with maxRetriesPerRequest: null (required by
// BullMQ) and the default offline queue, so a command issued while Redis is
// down does NOT reject — it buffers and hangs until reconnect. A try/catch
// alone would never fire; requests would hang instead of failing open. So every
// rate-limiter Redis call is raced against a short timeout that converts a hung
// command into a rejection the catch can handle.
const REDIS_OP_TIMEOUT_MS = 1000

function withRedisTimeout<T>(op: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Redis operation timed out')), REDIS_OP_TIMEOUT_MS)
  })
  return Promise.race([op, timeout]).finally(() => clearTimeout(timer)) as Promise<T>
}

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

  try {
    const result = await withRedisTimeout(redis.eval(
      SLIDING_WINDOW_LUA,
      1,
      key,
      String(now),
      String(windowSeconds * 1000),
      String(limit),
      member,
      String(windowSeconds),
    )) as [number, number]

    const count = result[0]
    const allowed = result[1] === 1

    return {
      allowed,
      remaining: Math.max(0, limit - count),
      resetInSeconds: windowSeconds,
    }
  } catch (err) {
    // Fail open: Redis unavailable must not break the endpoint.
    logger.error({ err, key }, 'Rate limiter unavailable (Redis) — failing open')
    return { allowed: true, remaining: limit, resetInSeconds: windowSeconds }
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
  // Best-effort: a failure to record a failed attempt must not break login.
  try {
    const pipeline = redis.pipeline()
    pipeline.incr(loginFailIPKey(ip))
    pipeline.incr(loginFailEmailKey(email))
    // Pipeline results are [[err, value], ...]. INCR returns 1 only when it
    // creates a brand-new key — that's the signal to set TTL. We avoid touching
    // the TTL of existing keys so repeated failures don't keep extending the window.
    const results = await withRedisTimeout(pipeline.exec()) as Array<[Error | null, number]> | null
    const ipNew = results?.[0]?.[1] === 1
    const emailNew = results?.[1]?.[1] === 1
    const expirePipeline = redis.pipeline()
    if (ipNew) expirePipeline.expire(loginFailIPKey(ip), LOGIN_FAIL_TTL)
    if (emailNew) expirePipeline.expire(loginFailEmailKey(email), LOGIN_FAIL_TTL)
    if (ipNew || emailNew) await expirePipeline.exec()
  } catch (err) {
    logger.error({ err }, 'Failed to record login failure (Redis) — continuing')
  }
}

export async function resetLoginFailures(ip: string, email: string): Promise<void> {
  try {
    await withRedisTimeout(redis.del(loginFailIPKey(ip), loginFailEmailKey(email)))
  } catch (err) {
    logger.error({ err }, 'Failed to reset login failures (Redis) — continuing')
  }
}

// A count high enough to exceed any CAPTCHA threshold, returned when the
// failure counters can't be read. The sliding-window limiter fails OPEN for
// availability, but the CAPTCHA gate fails CLOSED here: if both relaxed at once,
// a Redis outage would give an attacker unlimited attempts AND no CAPTCHA
// simultaneously. Forcing CAPTCHA degrades UX (humans solve one challenge),
// not availability, and keeps brute-force protection alive during the outage.
const CAPTCHA_FORCE_COUNT = 1_000_000

export async function getLoginFailureCount(
  ip: string,
  email: string,
): Promise<{ ip: number; email: number }> {
  try {
    if (!email) return { ip: Number((await withRedisTimeout(redis.get(loginFailIPKey(ip)))) ?? 0), email: 0 }
    const [ipCount, emailCount] = await withRedisTimeout(redis.mget(loginFailIPKey(ip), loginFailEmailKey(email)))
    return {
      ip: Number(ipCount ?? 0),
      email: Number(emailCount ?? 0),
    }
  } catch (err) {
    logger.error({ err }, 'Failed to read login failure counts (Redis) — forcing CAPTCHA')
    return { ip: CAPTCHA_FORCE_COUNT, email: CAPTCHA_FORCE_COUNT }
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
