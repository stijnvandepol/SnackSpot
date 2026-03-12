import { describe, expect, it } from 'vitest'
import { CreateCommentSchema, CreateReviewSchema, UpdateReviewSchema } from '@snackspot/shared'

describe('CreateReviewSchema structured ratings', () => {
  it('accepts ratings object', () => {
    const parsed = CreateReviewSchema.safeParse({
      placeId: 'place_1',
      ratings: { taste: 5, value: 4, portion: 4, service: null },
      text: 'Very good meal and fast service',
      photoIds: ['photo_1'],
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts half-star increments', () => {
    const parsed = CreateReviewSchema.safeParse({
      placeId: 'place_1',
      ratings: { taste: 4.5, value: 4, portion: 3.5, service: 2.5 },
      text: 'Very good meal and fast service',
      photoIds: ['photo_1'],
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects out-of-range rating values', () => {
    const parsed = CreateReviewSchema.safeParse({
      placeId: 'place_1',
      ratings: { taste: 0, value: 4, portion: 4, service: null },
      text: 'Very good meal and fast service',
      photoIds: ['photo_1'],
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects non-0.5 increments', () => {
    const parsed = CreateReviewSchema.safeParse({
      placeId: 'place_1',
      ratings: { taste: 4.3, value: 4, portion: 4, service: null },
      text: 'Very good meal and fast service',
      photoIds: ['photo_1'],
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects empty photoIds (at least one photo required)', () => {
    const parsed = CreateReviewSchema.safeParse({
      placeId: 'place_1',
      ratings: { taste: 4, value: 4, portion: 4, service: null },
      text: 'Very good meal and fast service',
      photoIds: [],
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects when neither rating nor ratings is provided', () => {
    const parsed = CreateReviewSchema.safeParse({
      placeId: 'place_1',
      text: 'Very good meal and fast service',
      photoIds: ['photo_1'],
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects review text shorter than 10 characters', () => {
    const parsed = CreateReviewSchema.safeParse({
      placeId: 'place_1',
      ratings: { taste: 4, value: 4, portion: 4, service: null },
      text: 'Too short',
      photoIds: ['photo_1'],
    })
    expect(parsed.success).toBe(false)
  })
})

describe('UpdateReviewSchema photos', () => {
  it('accepts photoIds on edit payload', () => {
    const parsed = UpdateReviewSchema.safeParse({
      text: 'Updated review text with enough characters',
      photoIds: ['photo_1', 'photo_2'],
    })
    expect(parsed.success).toBe(true)
  })
})

describe('CreateCommentSchema', () => {
  it('accepts a valid comment body', () => {
    const parsed = CreateCommentSchema.safeParse({ text: 'Helemaal mee eens, top plek.' })
    expect(parsed.success).toBe(true)
  })

  it('rejects an empty comment', () => {
    const parsed = CreateCommentSchema.safeParse({ text: '' })
    expect(parsed.success).toBe(false)
  })

  it('rejects a comment exceeding 1000 characters', () => {
    const parsed = CreateCommentSchema.safeParse({ text: 'a'.repeat(1001) })
    expect(parsed.success).toBe(false)
  })
})
