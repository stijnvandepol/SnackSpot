import { describe, it, expect } from 'vitest'
import { CreateBiteSchema, MEAL_SLOT_VALUES } from '@snackspot/shared'

const base = { photoId: 'photo_1', timezone: 'Europe/Amsterdam' }

describe('CreateBiteSchema meal slots', () => {
  it('accepts every published meal slot, including DRINK', () => {
    expect(MEAL_SLOT_VALUES).toContain('DRINK')
    for (const mealSlot of MEAL_SLOT_VALUES) {
      const parsed = CreateBiteSchema.safeParse({ ...base, mealSlot })
      expect(parsed.success).toBe(true)
    }
  })

  it('rejects unknown meal slots', () => {
    expect(CreateBiteSchema.safeParse({ ...base, mealSlot: 'BEER' }).success).toBe(false)
  })

  it('still defaults to SNACK when omitted', () => {
    const parsed = CreateBiteSchema.parse(base)
    expect(parsed.mealSlot).toBe('SNACK')
  })
})
