import { describe, expect, it } from 'vitest'
import { progressForCriteria } from './badge-service'

describe('progressForCriteria', () => {
  const snapshot = {
    postsCount: 12,
    uniqueLocationsCount: 6,
    activeDaysCount: 7,
    likesReceivedCount: 30,
  }

  it('maps POSTS_COUNT deterministically', () => {
    expect(progressForCriteria('POSTS_COUNT', snapshot)).toBe(12)
  })

  it('maps LIKES_RECEIVED_COUNT deterministically', () => {
    expect(progressForCriteria('LIKES_RECEIVED_COUNT', snapshot)).toBe(30)
  })
})
