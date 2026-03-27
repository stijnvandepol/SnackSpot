import type { Metadata } from 'next'

const title = 'Explore Food Spots'
const description =
  'Search and explore local food spots on SnackSpot. Browse places with recent reviews, filter by tags, and find hidden gems in your area.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/search' },
  openGraph: { title, description },
  twitter: { title, description },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children
}
