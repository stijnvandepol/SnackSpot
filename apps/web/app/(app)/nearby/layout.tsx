import type { Metadata } from 'next'

const title = 'Snackbars in de buurt'
const description =
  'Vind snackbars en eettentjes bij jou in de buurt. Gebruik je locatie of vul een adres in en zie op de kaart waar mensen recent gegeten hebben — of begin bij een stad.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/nearby' },
  openGraph: { title: `${title} | SnackSpot`, description, locale: 'nl_NL' },
  twitter: { title: `${title} | SnackSpot`, description },
}

export default function NearbyLayout({ children }: { children: React.ReactNode }) {
  return children
}
