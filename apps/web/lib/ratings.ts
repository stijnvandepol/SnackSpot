export interface RatingInput {
  taste: number
  value: number
  portion: number
  service?: number | null
}

export interface NormalizedRatings {
  taste: number
  value: number
  portion: number
  service: number | null
  overall: number
}

export function roundToHalfStep(value: number): number {
  return Math.round(value * 2) / 2
}

export function computeOverallRating(input: RatingInput): number {
  const values = [input.taste, input.value, input.portion]
  if (typeof input.service === 'number') values.push(input.service)
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length
  return roundToHalfStep(avg)
}

export function normalizeRatings(input: RatingInput): NormalizedRatings {
  return {
    taste: input.taste,
    value: input.value,
    portion: input.portion,
    service: input.service ?? null,
    overall: computeOverallRating(input),
  }
}
