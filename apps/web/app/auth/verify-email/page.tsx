'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage('No verification token found. Please use the link from your email.')
      return
    }

    let cancelled = false

    async function verify() {
      try {
        const res = await fetch('/api/v1/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        if (cancelled) return

        if (res.status === 429) {
          setStatus('error')
          setErrorMessage('Too many requests – please try again later.')
          return
        }

        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          setStatus('error')
          setErrorMessage(json?.error ?? 'This verification link is invalid or has expired.')
          return
        }

        setStatus('success')
      } catch {
        if (!cancelled) {
          setStatus('error')
          setErrorMessage('Something went wrong. Please try again.')
        }
      }
    }

    verify()
    return () => { cancelled = true }
  }, [token])

  return (
    <div className="min-h-screen bg-gradient-to-b from-snack-surface to-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mb-3 text-2xl font-heading font-bold">
            <span className="text-snack-primary">Snack</span>
            <span className="text-snack-accent inline-flex items-center">
              Sp
              <span className="inline-flex h-[0.95em] w-[0.75em] items-center justify-center align-middle">
                <svg viewBox="0 0 16 20" fill="none" className="h-[0.95em] w-[0.75em]" aria-hidden="true">
                  <path d="M8 19c2.6-3.5 6-7.5 6-11a6 6 0 1 0-12 0c0 3.5 3.4 7.5 6 11Z" fill="currentColor"/>
                  <circle cx="8" cy="8" r="2.25" fill="white"/>
                </svg>
              </span>
              t
            </span>
          </div>
          <h2 className="text-2xl font-heading font-bold text-snack-text">Email verification</h2>
        </div>

        {status === 'loading' && (
          <div className="card p-6 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-snack-surface flex items-center justify-center animate-pulse">
              <svg className="w-6 h-6 text-snack-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-snack-muted text-sm">Verifying your email address…</p>
          </div>
        )}

        {status === 'success' && (
          <div className="card p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-snack-text">Email verified!</p>
              <p className="text-sm text-snack-muted mt-1">
                Your email address has been confirmed. You are all set.
              </p>
            </div>
            <Link href="/feed" className="btn-primary inline-block w-full text-center">
              Go to feed
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="card p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-snack-text">Verification failed</p>
              <p className="text-sm text-snack-muted mt-1">{errorMessage}</p>
            </div>
            <Link href="/feed" className="btn-primary inline-block w-full text-center">
              Go to feed
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  )
}
