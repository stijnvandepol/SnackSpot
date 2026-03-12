import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Explore',
  alternates: {
    canonical: '/search',
  },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children
}
