import type { Metadata } from 'next'

const title = 'Snackplekken in de buurt'
const description =
  'Vind snackbars en cafetaria\'s bij je in de buurt. Gebruik je locatie of vul een adres in en bekijk op de kaart welke snackplekken reviews hebben.'

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
