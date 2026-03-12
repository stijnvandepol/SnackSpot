import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nearby',
  alternates: {
    canonical: '/nearby',
  },
}

export default function NearbyLayout({ children }: { children: React.ReactNode }) {
  return children
}
