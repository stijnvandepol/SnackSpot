import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { timeAgo } from './time'

// Pin the clock so every assertion uses a stable "now"
const NOW = new Date('2024-06-15T12:00:00.000Z')

describe('timeAgo — English relative time', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── "zojuist" threshold ────────────────────────────────────────────────────

  it('returns "just now" for an event 0 seconds ago', () => {
    expect(timeAgo(NOW)).toBe('just now')
  })

  it('returns "just now" for an event 59 seconds ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 59_000))).toBe('just now')
  })

  it('does NOT return "zojuist" for an event exactly 60 seconds ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 60_000))).not.toBe('just now')
  })

  // ─── Minutes ────────────────────────────────────────────────────────────────

  it('returns "1m" for exactly 60 seconds ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 60_000))).toBe('1m')
  })

  it('returns "5m" for 5 minutes ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 5 * 60_000))).toBe('5m')
  })

  it('returns "59m" for 59 minutes ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 59 * 60_000))).toBe('59m')
  })

  it('does NOT return a minutes value for exactly 60 minutes ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 60 * 60_000))).not.toMatch(/m$/)
  })

  // ─── Hours ──────────────────────────────────────────────────────────────────

  it('returns "1h" for exactly 1 hour ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 3_600_000))).toBe('1h')
  })

  it('returns "2h" for 2 hours ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 2 * 3_600_000))).toBe('2h')
  })

  it('returns "23h" for 23 hours ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 23 * 3_600_000))).toBe('23h')
  })

  it('does NOT return an hours value for exactly 24 hours ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 24 * 3_600_000))).not.toMatch(/h$/)
  })

  // ─── Days ───────────────────────────────────────────────────────────────────

  it('returns "1d" for exactly 1 day ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 86_400_000))).toBe('1d')
  })

  it('returns "3d" for 3 days ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 3 * 86_400_000))).toBe('3d')
  })

  it('returns "6d" for 6 days ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 6 * 86_400_000))).toBe('6d')
  })

  it('does NOT return a days value for 7 days ago', () => {
    expect(timeAgo(new Date(NOW.getTime() - 7 * 86_400_000))).not.toMatch(/\d+d$/)
  })

  // ─── Locale date ────────────────────────────────────────────────────────────

  it('returns an en-GB formatted date for events 7+ days ago', () => {
    const result = timeAgo(new Date(NOW.getTime() - 7 * 86_400_000))
    // Should look like "8 Jun" — at least one digit + space + alpha month abbreviation
    expect(result).toMatch(/^\d{1,2} [A-Za-z]{3}$/)
  })

  it('accepts a date string (ISO format)', () => {
    const isoString = new Date(NOW.getTime() - 30_000).toISOString()
    expect(timeAgo(isoString)).toBe('just now')
  })

  it('accepts a Date object', () => {
    const date = new Date(NOW.getTime() - 120_000) // 2 min
    expect(timeAgo(date)).toBe('2m')
  })
})
