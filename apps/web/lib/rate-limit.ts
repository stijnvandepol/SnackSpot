import { redis } from './redis'
import { env } from './env'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetIn: number  // seconds
}

// Lua script for an atomic sliding-window rate limit.
//
// The previous pipeline approach unconditionally added the new member before
// checking the count.  This meant that over-limit (blocked) requests still
// consumed a slot, allowing a flood of rejected requests to hold legitimate
// callers over the threshold for the entire window duration.
//
// The Lua script runs atomically on a single Redis shard:
//   1. Remove expired entries from the sorted set.
//   2. Count how many entries currently exist.
//   3. Only insert the new member when the count is still below the limit.
//   4. (Re-)set the TTL so the key is cleaned up after the window expires.
//   5. Return [currentCount, wasAdded] to the caller.
const RATE_LIMIT_SCRIPT = `
local key   = KEYS[1]
local now   = tonumber(ARGV[1])
local winMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local winSec = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, 0, now - winMs)
local count = redis.call('ZCARD', key)

local added = 0
if count < limit then
  redis.call('ZADD', key, now, member)
  added = 1
  count = count + 1
end

redis.call('EXPIRE', key, winSec)
return {count, added}
`

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
    RATE_LIMIT_SCRIPT,
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
    resetIn: windowSeconds,
  }
}

export function rateLimitIP(ip: string, action: string, limit: number, windowSeconds: number) {
  return rateLimit(`rl:ip:${action}:${ip}`, limit, windowSeconds)
}

export function rateLimitUser(userId: string, action: string, limit: number, windowSeconds: number) {
  return rateLimit(`rl:user:${action}:${userId}`, limit, windowSeconds)
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
  // EXPIRE is only set when the key is newly created (INCR returns 1) to prevent
  // an attacker from resetting the TTL on every attempt and keeping the counter
  // alive indefinitely. Two keys share the same TTL constant but are set independently.
  const pipeline = redis.pipeline()
  pipeline.incr(loginFailIPKey(ip))
  pipeline.incr(loginFailEmailKey(email))
  const results = await pipeline.exec()
  const ipNew = (results?.[0]?.[1] as number) === 1
  const emailNew = (results?.[1]?.[1] as number) === 1
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

