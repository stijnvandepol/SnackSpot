type Entry = {
  count: number
  resetAt: number
}

const store = new Map<string, Entry>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

export function getClientIp(headers: Headers): string {
  const xRealIp = headers.get('x-real-ip')?.trim()
  if (xRealIp) return xRealIp

  const xForwardedFor = headers.get('x-forwarded-for') ?? ''
  const firstForwarded = xForwardedFor.split(',')[0]?.trim()
  if (firstForwarded) return firstForwarded

  return '127.0.0.1'
}

export function rateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now()
  const existing = store.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowSeconds * 1000
    store.set(key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetInSeconds: windowSeconds,
    }
  }

  existing.count += 1
  store.set(key, existing)

  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetInSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}
