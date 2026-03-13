import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SnackSpot — Discover local food spots',
  description:
    'Discover under-the-radar food spots near you. Browse reviews of local snack bars, cafés, and hidden gems shared by the community.',
  alternates: {
    canonical: '/feed',
  },
}

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return children
}
