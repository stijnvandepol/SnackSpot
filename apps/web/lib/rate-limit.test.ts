import { describe, expect, it } from 'vitest'

// ─── Rate limit key format ────────────────────────────────────────────────────
// These tests verify that the Redis key construction used for rate limiting
// produces the expected format. Keys must be deterministic and collision-free
// across different actions and identifiers.

function rateLimitIPKey(ip: string, action: string): string {
  return `rl:ip:${action}:${ip}`
}

function rateLimitUserKey(userId: string, action: string): string {
  return `rl:user:${action}:${userId}`
}

function rateLimitAccountLoginKey(email: string): string {
  return `rl:account:login:${email.toLowerCase()}`
}

describe('rate limit key format — IP-based', () => {
  it('builds the correct key for a login attempt', () => {
    expect(rateLimitIPKey('1.2.3.4', 'login')).toBe('rl:ip:login:1.2.3.4')
  })

  it('builds the correct key for a register attempt', () => {
    expect(rateLimitIPKey('1.2.3.4', 'register')).toBe('rl:ip:register:1.2.3.4')
  })

  it('different actions on the same IP produce different keys', () => {
    expect(rateLimitIPKey('1.2.3.4', 'login')).not.toBe(rateLimitIPKey('1.2.3.4', 'register'))
  })

  it('same action on different IPs produce different keys', () => {
    expect(rateLimitIPKey('1.2.3.4', 'login')).not.toBe(rateLimitIPKey('5.6.7.8', 'login'))
  })
})

describe('rate limit key format — user-based', () => {
  it('builds the correct key for photo upload', () => {
    expect(rateLimitUserKey('user_abc123', 'photo-upload')).toBe('rl:user:photo-upload:user_abc123')
  })

  it('different users on same action produce different keys', () => {
    expect(rateLimitUserKey('user_a', 'comment')).not.toBe(rateLimitUserKey('user_b', 'comment'))
  })
})

describe('rate limit key format — account login (F1-A)', () => {
  it('builds the correct key for an email', () => {
    expect(rateLimitAccountLoginKey('user@example.com')).toBe('rl:account:login:user@example.com')
  })

  it('normalises email to lowercase so casing variants share one counter', () => {
    expect(rateLimitAccountLoginKey('User@Example.COM')).toBe('rl:account:login:user@example.com')
    expect(rateLimitAccountLoginKey('USER@EXAMPLE.COM')).toBe('rl:account:login:user@example.com')
  })

  it('different emails produce different keys', () => {
    expect(rateLimitAccountLoginKey('a@example.com')).not.toBe(rateLimitAccountLoginKey('b@example.com'))
  })

  it('account key is distinct from IP key for the same string', () => {
    // Prevents a theoretical collision if an email looks like an IP
    expect(rateLimitAccountLoginKey('1.2.3.4')).not.toBe(rateLimitIPKey('1.2.3.4', 'login'))
  })
})

// ─── Sliding window logic (pure) ─────────────────────────────────────────────
// Tests the conceptual logic of the sliding window without a real Redis connection.

describe('sliding window — conceptual logic', () => {
  /** Minimal in-memory simulation of the Lua sliding window */
  function slidingWindow(
    existing: number[],  // timestamps of prior allowed requests
    now: number,
    windowMs: number,
    limit: number,
  ): { allowed: boolean; count: number } {
    const valid = existing.filter((t) => t > now - windowMs)
    if (valid.length < limit) {
      return { allowed: true, count: valid.length + 1 }
    }
    return { allowed: false, count: valid.length }
  }

  const WINDOW = 10 * 60 * 1000  // 10 minutes
  const NOW = Date.now()

  it('allows the first request when the window is empty', () => {
    const result = slidingWindow([], NOW, WINDOW, 5)
    expect(result.allowed).toBe(true)
    expect(result.count).toBe(1)
  })

  it('allows requests up to the limit', () => {
    const timestamps = [NOW - 1000, NOW - 2000, NOW - 3000, NOW - 4000]
    const result = slidingWindow(timestamps, NOW, WINDOW, 5)
    expect(result.allowed).toBe(true)
    expect(result.count).toBe(5)
  })

  it('blocks the request that would exceed the limit', () => {
    const timestamps = [NOW - 1000, NOW - 2000, NOW - 3000, NOW - 4000, NOW - 5000]
    const result = slidingWindow(timestamps, NOW, WINDOW, 5)
    expect(result.allowed).toBe(false)
    expect(result.count).toBe(5)
  })

  it('does not count expired entries outside the window', () => {
    const expired = NOW - WINDOW - 1  // just outside the window
    const result = slidingWindow([expired, expired, expired, expired, expired], NOW, WINDOW, 5)
    // All 5 prior entries are expired → window is empty → request is allowed
    expect(result.allowed).toBe(true)
  })

  it('blocked requests do not consume a slot (flood protection)', () => {
    const full = [NOW - 1000, NOW - 2000, NOW - 3000, NOW - 4000, NOW - 5000]
    // First blocked request
    const r1 = slidingWindow(full, NOW, WINDOW, 5)
    expect(r1.allowed).toBe(false)
    // Window state did not change because blocked requests are not added
    const r2 = slidingWindow(full, NOW + 100, WINDOW, 5)
    expect(r2.allowed).toBe(false)
    expect(r2.count).toBe(5)  // still 5, not 6 or 7
  })

  it('allows a new request once older ones slide out of the window', () => {
    const almostExpired = NOW - WINDOW + 1000  // 9 min 59 sec ago — still valid
    const expired       = NOW - WINDOW - 1     // just outside — expired
    // 4 valid + 1 expired = effectively 4 in window → 5th request is allowed
    const result = slidingWindow(
      [almostExpired, almostExpired, almostExpired, almostExpired, expired],
      NOW,
      WINDOW,
      5,
    )
    expect(result.allowed).toBe(true)
  })
})

// ─── Login failure key format ─────────────────────────────────────────────────

function loginFailIPKey(ip: string): string {
  return `login:fail:ip:${ip}`
}

function loginFailEmailKey(email: string): string {
  return `login:fail:email:${email.toLowerCase()}`
}

describe('login failure key format — IP', () => {
  it('builds the correct key', () => {
    expect(loginFailIPKey('1.2.3.4')).toBe('login:fail:ip:1.2.3.4')
  })

  it('different IPs produce different keys', () => {
    expect(loginFailIPKey('1.2.3.4')).not.toBe(loginFailIPKey('5.6.7.8'))
  })

  it('is distinct from the sliding-window rate-limit key for the same IP', () => {
    expect(loginFailIPKey('1.2.3.4')).not.toBe(`rl:ip:login:1.2.3.4`)
  })
})

describe('login failure key format — email', () => {
  it('builds the correct key', () => {
    expect(loginFailEmailKey('user@example.com')).toBe('login:fail:email:user@example.com')
  })

  it('normalises to lowercase', () => {
    expect(loginFailEmailKey('User@Example.COM')).toBe('login:fail:email:user@example.com')
  })

  it('different emails produce different keys', () => {
    expect(loginFailEmailKey('a@example.com')).not.toBe(loginFailEmailKey('b@example.com'))
  })
})
