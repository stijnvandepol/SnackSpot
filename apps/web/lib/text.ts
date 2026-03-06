export function capitalizeFirst(input: string): string {
  if (input.length === 0) return input
  return input[0].toUpperCase() + input.slice(1)
}

export function normalizeDishName(input: string | undefined): string | undefined {
  if (input === undefined) return undefined

  const trimmed = input.trim()
  if (trimmed.length === 0) return undefined

  return capitalizeFirst(trimmed)
}
