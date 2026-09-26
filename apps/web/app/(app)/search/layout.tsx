import type { Metadata } from 'next'

const title = 'Zoek snackplekken op naam, gerecht of label'
const description =
  'Zoek snackbars en cafetaria\'s op naam of gerecht, filter reviews op label of begin bij een stad. Bekijk snackplekken met recente fotoreviews.'

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
