import { describe, it, expect, vi } from 'vitest'

// Simulate a Redis outage: every call rejects. The rate limiter must degrade
// gracefully (fail open) rather than propagate the error and 500 the endpoint.
vi.mock('./redis', () => ({
  redis: {
    eval: vi.fn().mockRejectedValue(new Error('Redis down')),
    get: vi.fn().mockRejectedValue(new Error('Redis down')),
    mget: vi.fn().mockRejectedValue(new Error('Redis down')),
    del: vi.fn().mockRejectedValue(new Error('Redis down')),
    pipeline: vi.fn(() => ({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockRejectedValue(new Error('Redis down')),
    })),
  },
}))
vi.mock('./logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('./env', () => ({ env: { TRUST_PROXY: false } }))

import {
  rateLimit,
  rateLimitUser,
  getLoginFailureCount,
  incrementLoginFailures,
  resetLoginFailures,
} from './rate-limit'

describe('rate limiting fails open when Redis is unavailable', () => {
  it('rateLimit allows the request instead of throwing', async () => {
    const r = await rateLimit('rl:test', 5, 60)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(5)
  })

  it('rateLimitUser allows the request', async () => {
    const r = await rateLimitUser('u1', 'review_like', 120, 3600)
    expect(r.allowed).toBe(true)
  })

  it('getLoginFailureCount reports zero (→ no CAPTCHA forced) on Redis failure', async () => {
    expect(await getLoginFailureCount('1.2.3.4', 'a@b.com')).toEqual({ ip: 0, email: 0 })
    expect(await getLoginFailureCount('1.2.3.4', '')).toEqual({ ip: 0, email: 0 })
  })

  it('incrementLoginFailures and resetLoginFailures swallow Redis errors', async () => {
    await expect(incrementLoginFailures('1.2.3.4', 'a@b.com')).resolves.toBeUndefined()
    await expect(resetLoginFailures('1.2.3.4', 'a@b.com')).resolves.toBeUndefined()
  })
})
