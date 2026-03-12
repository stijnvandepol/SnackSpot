export interface GuideDefinition {
  href: string
  title: string
  description: string
}

export const PILLAR_GUIDES: GuideDefinition[] = [
  {
    href: '/guides/hidden-gem-restaurants-near-me',
    title: 'Hidden Gem Restaurants Near Me',
    description:
      'A practical framework for finding underrated local food spots without relying on generic top lists.',
  },
  {
    href: '/guides/how-to-find-underrated-restaurants',
    title: 'How To Find Underrated Restaurants',
    description:
      'Step-by-step tactics to uncover overlooked places with strong quality, value, and consistency.',
  },
  {
    href: '/guides/how-to-avoid-tourist-trap-restaurants',
    title: 'How To Avoid Tourist Trap Restaurants',
    description:
      'Signals and workflows to avoid overpriced low-quality picks and choose local favorites with confidence.',
  },
  {
    href: '/guides/how-to-find-restaurants-by-vibe',
    title: 'How To Find Restaurants By Vibe',
    description:
      'Use mood, occasion, and environment signals to match the right place to the right moment.',
  },
  {
    href: '/guides/how-to-spot-fake-restaurant-reviews',
    title: 'How To Spot Fake Restaurant Reviews',
    description:
      'A review-quality checklist that helps you identify trustworthy feedback and avoid manipulated ratings.',
  },
]
