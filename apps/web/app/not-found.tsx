import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Page Not Found',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="font-heading text-6xl font-bold text-snack-primary">404</h1>
      <p className="mt-4 text-xl font-semibold text-snack-text">Page not found</p>
      <p className="mt-2 text-sm text-snack-muted">
        This page does not exist or has been removed.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/feed" className="btn-primary text-sm">
          Go to Feed
        </Link>
        <Link href="/product" className="btn-secondary text-sm">
          Learn about SnackSpot
        </Link>
      </div>
    </div>
  )
}
