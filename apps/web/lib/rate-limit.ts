import { redis } from './redis'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetIn: number  // seconds
}

/**
 * Sliding-window rate limiter backed by Redis sorted sets.
 * @param key     unique redis key
 * @param limit   max requests allowed in window
 * @param windowSeconds  window size in seconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = now - windowSeconds * 1000
  const member = `${now}-${Math.random().toString(36).slice(2)}`

  const pipeline = redis.pipeline()
  pipeline.zremrangebyscore(key, 0, windowStart)
  pipeline.zadd(key, now, member)
  pipeline.zcard(key)
  pipeline.expire(key, windowSeconds)
  const results = await pipeline.exec()

  const count = (results?.[2]?.[1] as number) ?? 0

  return {
    allowed: count <= limit,
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

/** Extract real IP from request (trusts X-Forwarded-For behind reverse proxy) */
export function getClientIP(req: Request): string {
  const xff = (req as any).headers?.get?.('x-forwarded-for') ?? ''
  return (xff ? xff.split(',')[0].trim() : null) ?? '127.0.0.1'
}
