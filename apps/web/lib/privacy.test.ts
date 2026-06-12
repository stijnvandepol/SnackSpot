import { describe, it, expect } from 'vitest'
import {
  RESTORE_WINDOW_DAYS,
  isWithinRestoreWindow,
  restorableUntil,
  canRestoreReview,
} from './privacy'

const DAY_MS = 24 * 60 * 60 * 1000
const now = new Date('2026-06-12T12:00:00Z')

describe('isWithinRestoreWindow', () => {
  it('is true immediately after deletion', () => {
    expect(isWithinRestoreWindow(now, now)).toBe(true)
  })

  it('is true exactly at the window boundary', () => {
    const deletedAt = new Date(now.getTime() - RESTORE_WINDOW_DAYS * DAY_MS)
    expect(isWithinRestoreWindow(deletedAt, now)).toBe(true)
  })

  it('is false one millisecond past the window', () => {
    const deletedAt = new Date(now.getTime() - RESTORE_WINDOW_DAYS * DAY_MS - 1)
    expect(isWithinRestoreWindow(deletedAt, now)).toBe(false)
  })
})

describe('restorableUntil', () => {
  it('is exactly RESTORE_WINDOW_DAYS after deletion', () => {
    expect(restorableUntil(now).getTime()).toBe(now.getTime() + RESTORE_WINDOW_DAYS * DAY_MS)
  })
})

describe('canRestoreReview', () => {
  const base = { userId: 'owner', deletedAt: now, deletedById: 'owner' as string | null }

  it('allows the owner to restore a self-deleted review within the window', () => {
    expect(canRestoreReview(base, 'owner', now)).toEqual({ allowed: true })
  })

  it('denies non-owners', () => {
    expect(canRestoreReview(base, 'someone-else', now)).toEqual({
      allowed: false,
      reason: 'NOT_OWNER',
    })
  })

  it('denies restoring a moderator-deleted review, even for the owner', () => {
    expect(canRestoreReview({ ...base, deletedById: 'mod-1' }, 'owner', now)).toEqual({
      allowed: false,
      reason: 'MOD_DELETED',
    })
  })

  it('treats a null deletedById as self-deleted (pre-migration rows)', () => {
    expect(canRestoreReview({ ...base, deletedById: null }, 'owner', now)).toEqual({
      allowed: true,
    })
  })

  it('denies once the window expired', () => {
    const deletedAt = new Date(now.getTime() - (RESTORE_WINDOW_DAYS + 1) * DAY_MS)
    expect(canRestoreReview({ ...base, deletedAt }, 'owner', now)).toEqual({
      allowed: false,
      reason: 'WINDOW_EXPIRED',
    })
  })

  it('denies when deletedAt is missing entirely', () => {
    expect(canRestoreReview({ ...base, deletedAt: null }, 'owner', now)).toEqual({
      allowed: false,
      reason: 'WINDOW_EXPIRED',
    })
  })
})
