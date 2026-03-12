'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (res.status === 429) {
        setError('Too many requests – please try again later.')
        return
      }

      // Always show the success state regardless of whether the email exists
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
          <h2 className="text-2xl font-heading font-bold text-snack-text">Forgot password?</h2>
          <p className="text-sm text-snack-muted mt-1">
            Enter your email and we&apos;ll send a reset link
          </p>
        </div>

        {submitted ? (
          <div className="card p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-snack-text">Check your email</p>
              <p className="text-sm text-snack-muted mt-1">
                If an account with that email exists, we&apos;ve sent a password reset link.
                The link is valid for 15 minutes.
                If you can&apos;t find the email, please check your spam folder.
              </p>
            </div>
            <Link href="/auth/login" className="text-sm text-snack-primary font-medium hover:underline">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100">
                {error}
              </div>
            )}

            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        {!submitted && (
          <p className="text-center mt-6 text-sm text-snack-muted">
            Remembered it?{' '}
            <Link href="/auth/login" className="text-snack-primary font-medium hover:underline">
              Back to login
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
