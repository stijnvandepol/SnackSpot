import { MEAL_SLOT_VALUES, type MealSlotValue } from '@snackspot/shared'

const MEAL_EMOJI: Record<string, string> = {
  BREAKFAST: '🍳',
  LUNCH: '🥪',
  DINNER: '🍝',
  SNACK: '🍟',
  DRINK: '☕',
}

const MEAL_LABEL: Record<string, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snack',
  DRINK: 'Drink',
}

export type MealSlot = MealSlotValue

/** Ordered meal slots for pickers: value + display label + emoji. */
export const MEAL_SLOTS: ReadonlyArray<{ value: MealSlot; label: string; emoji: string }> =
  MEAL_SLOT_VALUES.map((value) => ({ value, label: MEAL_LABEL[value], emoji: MEAL_EMOJI[value] }))

export function mealEmoji(slot: string): string {
  return MEAL_EMOJI[slot] ?? '🍽️'
}

export function mealLabel(slot: string): string {
  return MEAL_LABEL[slot] ?? 'Meal'
}
