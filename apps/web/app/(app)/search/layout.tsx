import type { Metadata } from 'next'

const title = 'Ontdek snackplekken bij jou in de buurt'
const description =
  'Zoek en blader door snackplekken op SnackSpot — van snackbar en cafetaria tot broodjeszaak. Bekijk zaken met recente fotoreviews, filter op label en vind verborgen parels bij jou in de buurt.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/search' },
  openGraph: { title: `${title} | SnackSpot`, description, locale: 'nl_NL' },
  twitter: { title: `${title} | SnackSpot`, description },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children
}
