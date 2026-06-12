import { describe, it, expect } from 'vitest'
import { MEAL_SLOTS, mealEmoji, mealLabel } from './meal'

describe('meal helpers', () => {
  it('maps known meal slots', () => {
    expect(mealEmoji('BREAKFAST')).toBe('🍳')
    expect(mealEmoji('SNACK')).toBe('🍟')
    expect(mealEmoji('DRINK')).toBe('🍺')
    expect(mealLabel('LUNCH')).toBe('Lunch')
    expect(mealLabel('DINNER')).toBe('Dinner')
    expect(mealLabel('DRINK')).toBe('Drink')
  })

  it('falls back for unknown slots', () => {
    expect(mealEmoji('BRUNCH')).toBe('🍽️')
    expect(mealLabel('BRUNCH')).toBe('Meal')
  })

  it('exposes all five slots in picker order', () => {
    expect(MEAL_SLOTS.map((s) => s.value)).toEqual([
      'BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'DRINK',
    ])
    expect(MEAL_SLOTS.at(-1)).toEqual({ value: 'DRINK', label: 'Drink', emoji: '🍺' })
  })
})
