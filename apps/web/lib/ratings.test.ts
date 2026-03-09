import { describe, expect, it } from 'vitest'
import { computeOverallRating } from './ratings'

describe('computeOverallRating', () => {
  it('computes average without service when service is null', () => {
    const overall = computeOverallRating({ taste: 5, value: 4, portion: 3, service: null })
    expect(overall).toBe(4)
  })

  it('computes average with service when provided', () => {
    const overall = computeOverallRating({ taste: 5, value: 4, portion: 3, service: 2 })
    expect(overall).toBe(3.5)
  })

  it('handles half-star inputs', () => {
    const overall = computeOverallRating({ taste: 4.5, value: 4, portion: 3.5, service: null })
    expect(overall).toBe(4)
  })

  it('rounds non-half averages to the nearest half-step', () => {
    const overall = computeOverallRating({ taste: 5, value: 5, portion: 5, service: 4 })
    expect(overall).toBe(5)
  })
})
