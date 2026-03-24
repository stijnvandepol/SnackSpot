import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nearby Food Spots',
  description:
    'Find food spots near your location on SnackSpot. Use GPS or enter an address to discover local snack bars, cafés, and hidden gems on the map.',
  alternates: {
    canonical: '/nearby',
  },
}

export default function NearbyLayout({ children }: { children: React.ReactNode }) {
  return children
}
