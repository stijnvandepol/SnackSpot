'use client'

import { useEffect } from 'react'
import Link from 'next/link'

// Route-segment error boundary for the whole app subtree. Next.js renders this
// when a Server or Client Component throws during rendering. `reset()` re-renders
// the segment so the user can retry without a full reload.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // The digest correlates this client-visible error with the server log entry.
    // Server-side logging happens via the pino logger; here we only surface it in dev.
    if (process.env.NODE_ENV !== 'production') console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="font-heading text-6xl font-bold text-snack-primary">Oops</h1>
      <p className="mt-4 text-xl font-semibold text-snack-text">Something went wrong</p>
      <p className="mt-2 text-sm text-snack-muted">
        An unexpected error occurred. You can try again or head back to the feed.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button onClick={reset} className="btn-primary text-sm">
          Try again
        </button>
        <Link href="/" className="btn-secondary text-sm">
          Go to Feed
        </Link>
      </div>
    </div>
  )
}
