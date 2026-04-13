import { describe, expect, it } from 'vitest'
import { isReviewTag, getReviewTagLabel, REVIEW_TAG_OPTIONS } from './review-tags'

// ─── isReviewTag ──────────────────────────────────────────────────────────────

describe('isReviewTag', () => {
  it('returns true for every value listed in REVIEW_TAG_OPTIONS', () => {
    for (const option of REVIEW_TAG_OPTIONS) {
      expect(isReviewTag(option.value), `expected "${option.value}" to be a valid tag`).toBe(true)
    }
  })

  it('returns false for an unknown string', () => {
    expect(isReviewTag('not-a-real-tag')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isReviewTag('')).toBe(false)
  })

  it('is case-sensitive (tags are lowercase-kebab)', () => {
    expect(isReviewTag('Budget-Spot')).toBe(false)
    expect(isReviewTag('BUDGET-SPOT')).toBe(false)
  })
})

// ─── getReviewTagLabel ────────────────────────────────────────────────────────

describe('getReviewTagLabel', () => {
  it('returns the human-readable label for each known tag', () => {
    for (const option of REVIEW_TAG_OPTIONS) {
      expect(getReviewTagLabel(option.value)).toBe(option.label)
    }
  })

  it('returns the raw input when the tag is not found', () => {
    expect(getReviewTagLabel('unknown-tag')).toBe('unknown-tag')
  })

  it('maps "budget-spot" to "Budget spot"', () => {
    expect(getReviewTagLabel('budget-spot')).toBe('Budget spot')
  })

  it('maps "street-food" to "Street food"', () => {
    expect(getReviewTagLabel('street-food')).toBe('Street food')
  })

  it('maps "late-night" to "Late night"', () => {
    expect(getReviewTagLabel('late-night')).toBe('Late night')
  })

  it('maps "worth-the-detour" to "Worth the detour"', () => {
    expect(getReviewTagLabel('worth-the-detour')).toBe('Worth the detour')
  })
})

// ─── REVIEW_TAG_OPTIONS structure ─────────────────────────────────────────────

describe('REVIEW_TAG_OPTIONS shape', () => {
  it('every option has a non-empty value, label and hint', () => {
    for (const option of REVIEW_TAG_OPTIONS) {
      expect(option.value.length).toBeGreaterThan(0)
      expect(option.label.length).toBeGreaterThan(0)
      expect(option.hint.length).toBeGreaterThan(0)
    }
  })

  it('every option value is valid according to isReviewTag', () => {
    for (const option of REVIEW_TAG_OPTIONS) {
      expect(isReviewTag(option.value)).toBe(true)
    }
  })

  it('all option values are unique', () => {
    const values = REVIEW_TAG_OPTIONS.map((o) => o.value)
    expect(new Set(values).size).toBe(values.length)
  })
})
