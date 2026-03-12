import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Home Feed',
  alternates: {
    canonical: '/feed',
  },
}

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return children
}
