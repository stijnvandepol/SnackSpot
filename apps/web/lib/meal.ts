export const MEAL_EMOJI: Record<string, string> = {
  BREAKFAST: '🍳',
  LUNCH: '🥪',
  DINNER: '🍝',
  SNACK: '🍟',
}

export const MEAL_LABEL: Record<string, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snack',
}

export function mealEmoji(slot: string): string {
  return MEAL_EMOJI[slot] ?? '🍽️'
}

export function mealLabel(slot: string): string {
  return MEAL_LABEL[slot] ?? 'Meal'
}
