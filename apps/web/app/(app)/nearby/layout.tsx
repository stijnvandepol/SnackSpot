import type { Metadata } from 'next'

const title = 'Snackplekken in de buurt'
const description =
  'Vind snackplekken bij jou in de buurt — van snackbar tot broodjeszaak. Gebruik je locatie of vul een adres in en zie op de kaart waar mensen recent gegeten hebben, of begin bij een stad.'

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
