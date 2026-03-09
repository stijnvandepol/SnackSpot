import { describe, expect, it } from 'vitest'
import { progressForCriteria } from './badge-service'

describe('progressForCriteria', () => {
  const snapshot = {
    postsCount: 12,
    postsLast30Days: 5,
    uniqueLocationsCount: 6,
    activeDaysCount: 7,
    bestStreakDays: 4,
    likesReceivedCount: 30,
    commentsReceivedCount: 11,
  }

  it('maps POSTS_COUNT deterministically', () => {
    expect(progressForCriteria('POSTS_COUNT', snapshot)).toBe(12)
  })

  it('maps LIKES_RECEIVED_COUNT deterministically', () => {
    expect(progressForCriteria('LIKES_RECEIVED_COUNT', snapshot)).toBe(30)
  })

  it('maps BEST_STREAK_DAYS deterministically', () => {
    expect(progressForCriteria('BEST_STREAK_DAYS', snapshot)).toBe(4)
  })

  it('maps POSTS_LAST_30_DAYS deterministically', () => {
    expect(progressForCriteria('POSTS_LAST_30_DAYS', snapshot)).toBe(5)
  })

  it('maps COMMENTS_RECEIVED_COUNT deterministically', () => {
    expect(progressForCriteria('COMMENTS_RECEIVED_COUNT', snapshot)).toBe(11)
  })
})
