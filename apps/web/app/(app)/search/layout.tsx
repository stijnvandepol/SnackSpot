import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Explore Food Spots',
  description:
    'Search and explore local food spots on SnackSpot. Browse places with recent reviews, filter by tags, and find hidden gems in your area.',
  alternates: {
    canonical: '/search',
  },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children
}
