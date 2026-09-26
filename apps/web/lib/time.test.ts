import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { timeAgo } from './time'

// Pin the clock so every assertion uses a stable "now"
const NOW = new Date('2024-06-15T12:00:00.000Z')

describe('timeAgo: Dutch relative time', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── "zojuist" threshold ────────────────────────────────────────────────────

  it('returns "zojuist" for an event 0 seconds ago', () => {
    expect(timeAgo(NOW)).toBe('zojuist')
  })

  it('returns "zojuist" for an event 59 seconds ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 59_000))).toBe('zojuist')
  })

  it('does NOT return "zojuist" for an event exactly 60 seconds ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 60_000))).not.toBe('zojuist')
  })

  // ─── Minutes ────────────────────────────────────────────────────────────────

  it('returns "1 min" for exactly 60 seconds ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 60_000))).toBe('1 min')
  })

  it('returns "5 min" for 5 minutes ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 5 * 60_000))).toBe('5 min')
  })

  it('returns "59 min" for 59 minutes ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 59 * 60_000))).toBe('59 min')
  })

  it('does NOT return a minutes value for exactly 60 minutes ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 60 * 60_000))).not.toMatch(/ min$/)
  })

  // ─── Hours ──────────────────────────────────────────────────────────────────

  it('returns "1 u" for exactly 1 hour ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 3_600_000))).toBe('1 u')
  })

  it('returns "2 u" for 2 hours ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 2 * 3_600_000))).toBe('2 u')
  })

  it('returns "23 u" for 23 hours ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 23 * 3_600_000))).toBe('23 u')
  })

  it('does NOT return an hours value for exactly 24 hours ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 24 * 3_600_000))).not.toMatch(/ u$/)
  })

  // ─── Days ───────────────────────────────────────────────────────────────────

  it('returns "1 d" for exactly 1 day ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 86_400_000))).toBe('1 d')
  })

  it('returns "3 d" for 3 days ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 3 * 86_400_000))).toBe('3 d')
  })

  it('returns "6 d" for 6 days ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 6 * 86_400_000))).toBe('6 d')
  })

  it('does NOT return a days value for 7 days ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 7 * 86_400_000))).not.toMatch(/\d+ d$/)
  })

  // ─── Locale date ────────────────────────────────────────────────────────────

  it('returns an nl-NL formatted date for events 7+ days ago', () => {
    const result = timeAgo(new Date(NOW.getTime() - 7 * 86_400_000))
    // Should look like "8 jun": one or two digits, a space and a short month name
    expect(result).toMatch(/^\d{1,2} [a-z]{3,4}\.?$/)
  })

  it('accepts a date string (ISO format)', () => {
    const isoString = new Date(NOW.getTime() - 30_000).toISOString()
    expect(timeAgo(isoString)).toBe('zojuist')
  })

  it('accepts a Date object', () => {
    const date = new Date(NOW.getTime() - 120_000) // 2 min
    expect(timeAgo(date)).toBe('2 min')
  })
})
