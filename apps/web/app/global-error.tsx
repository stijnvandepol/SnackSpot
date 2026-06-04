'use client'

import { useEffect } from 'react'

// Last-resort boundary: catches errors thrown by the root layout itself.
// It replaces the root layout, so it must render its own <html>/<body> and
// cannot rely on the app's global stylesheet (which may be the thing that
// failed). Styling is therefore inline and dependency-free.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '1rem',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#1f2937',
          backgroundColor: '#ffffff',
        }}
      >
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Something went wrong</h1>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '1rem',
            padding: '0.625rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#ffffff',
            backgroundColor: '#ef6c2e',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
