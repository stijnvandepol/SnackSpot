import { redis } from './redis'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

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
