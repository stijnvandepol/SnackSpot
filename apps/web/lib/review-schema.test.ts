import { describe, expect, it } from 'vitest'
import { CreateReviewSchema } from '@snackspot/shared'

describe('CreateReviewSchema structured ratings', () => {
  it('accepts ratings object', () => {
    const parsed = CreateReviewSchema.safeParse({
      placeId: 'place_1',
      ratings: { taste: 5, value: 4, portion: 4, service: null },
      text: 'Very good meal and fast service',
      photoIds: [],
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects out-of-range rating values', () => {
    const parsed = CreateReviewSchema.safeParse({
      placeId: 'place_1',
      ratings: { taste: 0, value: 4, portion: 4, service: null },
      text: 'Very good meal and fast service',
      photoIds: [],
    })
    expect(parsed.success).toBe(false)
  })
})
