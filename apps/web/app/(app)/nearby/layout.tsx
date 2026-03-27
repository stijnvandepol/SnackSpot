import type { Metadata } from 'next'

const title = 'Nearby Food Spots'
const description =
  'Find food spots near your location on SnackSpot. Use GPS or enter an address to discover local snack bars, cafés, and hidden gems on the map.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/nearby' },
  openGraph: { title, description },
  twitter: { title, description },
}

export default function NearbyLayout({ children }: { children: React.ReactNode }) {
  return children
}
