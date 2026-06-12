import { describe, it, expect } from 'vitest'
import { mealEmoji, mealLabel } from './meal'

describe('meal helpers', () => {
  it('maps known meal slots', () => {
    expect(mealEmoji('BREAKFAST')).toBe('🍳')
    expect(mealEmoji('SNACK')).toBe('🍟')
    expect(mealLabel('LUNCH')).toBe('Lunch')
    expect(mealLabel('DINNER')).toBe('Dinner')
  })

  it('falls back for unknown slots', () => {
    expect(mealEmoji('BRUNCH')).toBe('🍽️')
    expect(mealLabel('BRUNCH')).toBe('Meal')
  })
})
