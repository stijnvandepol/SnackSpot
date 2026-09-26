import { REVIEW_TAG_VALUES } from '@snackspot/shared'

export type ReviewTag = (typeof REVIEW_TAG_VALUES)[number]

export const REVIEW_TAG_OPTIONS: Array<{ value: ReviewTag; label: string; hint: string }> = [
  { value: 'budget-spot', label: 'Voordelig', hint: 'Waar voor je geld zonder veel uit te geven.' },
  { value: 'street-food', label: 'Streetfood', hint: 'Snel, informeel en de moeite waard om even te stoppen.' },
  { value: 'late-night', label: 'Late trek', hint: 'Handig als de meeste keukens al dicht zijn.' },
  { value: 'local-favorite', label: 'Favoriet in de buurt', hint: 'Een plek waar mensen uit de buurt steeds terugkomen.' },
  { value: 'worth-the-detour', label: 'Omrijden waard', hint: 'Goed genoeg om een stukje verder voor te rijden.' },
  { value: 'small-but-mighty', label: 'Klein maar fijn', hint: 'Kleine zaak, goed eten.' },
  { value: 'under-the-radar', label: 'Onder de radar', hint: 'Makkelijk te missen als niemand je tipt.' },
  { value: 'unexpected-location', label: 'Onverwachte locatie', hint: 'Zit op een plek waar je het niet zou verwachten.' },
]

const reviewTagLabels = new Map(REVIEW_TAG_OPTIONS.map((option) => [option.value, option.label]))

export function isReviewTag(value: string): value is ReviewTag {
  return REVIEW_TAG_VALUES.includes(value as ReviewTag)
}

export function getReviewTagLabel(tag: string): string {
  return reviewTagLabels.get(tag as ReviewTag) ?? tag
}
