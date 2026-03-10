import { REVIEW_TAG_VALUES } from '@snackspot/shared'

export type ReviewTag = (typeof REVIEW_TAG_VALUES)[number]

export const REVIEW_TAG_OPTIONS: Array<{ value: ReviewTag; label: string; hint: string }> = [
  { value: 'budget-spot', label: 'Budget spot', hint: 'Great value without spending much.' },
  { value: 'street-food', label: 'Street food', hint: 'Casual, quick, and worth stopping for.' },
  { value: 'late-night', label: 'Late night', hint: 'Good when most kitchens are already closed.' },
  { value: 'local-favorite', label: 'Local favorite', hint: 'The kind of place locals keep returning to.' },
  { value: 'worth-the-detour', label: 'Worth the detour', hint: 'Good enough to travel a bit further for.' },
  { value: 'small-but-mighty', label: 'Small but mighty', hint: 'Tiny spot, strong food.' },
  { value: 'under-the-radar', label: 'Under the radar', hint: 'Easy to miss unless someone tips you off.' },
  { value: 'unexpected-location', label: 'Unexpected location', hint: 'Hidden in a place you would not expect.' },
]

const reviewTagLabels = new Map(REVIEW_TAG_OPTIONS.map((option) => [option.value, option.label]))

export function isReviewTag(value: string): value is ReviewTag {
  return REVIEW_TAG_VALUES.includes(value as ReviewTag)
}

export function getReviewTagLabel(tag: string): string {
  return reviewTagLabels.get(tag as ReviewTag) ?? tag
}
