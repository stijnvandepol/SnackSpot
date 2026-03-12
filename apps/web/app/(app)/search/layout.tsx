import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Search',
  alternates: {
    canonical: '/search',
  },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children
}
