import { describe, expect, it } from 'vitest'
import {
  generateRefreshToken,
  generateTokenFamily,
  hashRefreshToken,
} from '@/lib/auth'

// ─── generateRefreshToken ─────────────────────────────────────────────────────

describe('generateRefreshToken', () => {
  it('returns an 80-character hex string (40 random bytes)', () => {
    const token = generateRefreshToken()
    expect(token).toHaveLength(80)
    expect(token).toMatch(/^[0-9a-f]{80}$/)
  })

  it('returns a different value on every call', () => {
    const tokens = Array.from({ length: 20 }, generateRefreshToken)
    const unique = new Set(tokens)
    expect(unique.size).toBe(20)
  })
})

// ─── generateTokenFamily ─────────────────────────────────────────────────────

describe('generateTokenFamily', () => {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  it('returns a valid UUID v4', () => {
    expect(generateTokenFamily()).toMatch(UUID_REGEX)
  })

  it('returns a different value on every call', () => {
    const families = Array.from({ length: 20 }, generateTokenFamily)
    const unique = new Set(families)
    expect(unique.size).toBe(20)
  })

  it('two logins from the same user get different families', () => {
    const sessionA = generateTokenFamily()
    const sessionB = generateTokenFamily()
    expect(sessionA).not.toBe(sessionB)
  })
})

// ─── hashRefreshToken ─────────────────────────────────────────────────────────

describe('hashRefreshToken', () => {
  it('returns a 64-character hex string (SHA-256 = 32 bytes)', () => {
    const hash = hashRefreshToken(generateRefreshToken())
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic — same input always produces the same hash', () => {
    const token = generateRefreshToken()
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token))
  })

  it('different tokens produce different hashes', () => {
    const hash1 = hashRefreshToken(generateRefreshToken())
    const hash2 = hashRefreshToken(generateRefreshToken())
    expect(hash1).not.toBe(hash2)
  })

  it('does not return the raw token (hash is not reversible by inspection)', () => {
    const token = generateRefreshToken()
    const hash = hashRefreshToken(token)
    expect(hash).not.toBe(token)
  })
})

// ─── Token family theft detection logic ──────────────────────────────────────
// Tests the pure business-logic conditions that the refresh route evaluates.
// (The route itself is not tested here to avoid mocking Next.js internals.)

describe('token family theft detection — business logic', () => {
  const FIVE_MINUTES_MS = 5 * 60 * 1000

  function isTheft(usedAt: Date, now: Date): boolean {
    return now.getTime() - usedAt.getTime() > FIVE_MINUTES_MS
  }

  it('flags theft when token was used more than 5 minutes ago', () => {
    const usedAt = new Date(Date.now() - FIVE_MINUTES_MS - 1)
    expect(isTheft(usedAt, new Date())).toBe(true)
  })

  it('does not flag theft when token was used less than 5 minutes ago (likely retry)', () => {
    const usedAt = new Date(Date.now() - 30_000) // 30 seconds ago
    expect(isTheft(usedAt, new Date())).toBe(false)
  })

  it('does not flag theft at exactly the 5-minute boundary', () => {
    const usedAt = new Date(Date.now() - FIVE_MINUTES_MS)
    expect(isTheft(usedAt, new Date())).toBe(false)
  })

  it('flags theft when token was used 10 minutes ago', () => {
    const usedAt = new Date(Date.now() - 10 * 60 * 1000)
    expect(isTheft(usedAt, new Date())).toBe(true)
  })
})
