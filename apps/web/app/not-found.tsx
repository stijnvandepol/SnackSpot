import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pagina niet gevonden',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="font-heading text-6xl font-bold text-snack-primary">404</h1>
      <p className="mt-4 text-xl font-semibold text-snack-text">Pagina niet gevonden</p>
      <p className="mt-2 text-sm text-snack-muted">
        Deze pagina bestaat niet of is verwijderd.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/" className="btn-primary text-sm">
          Naar de feed
        </Link>
        <Link href="/product" className="btn-secondary text-sm">
          Wat is SnackSpot?
        </Link>
      </div>
    </div>
  )
}
