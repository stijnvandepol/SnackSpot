'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { SnackSpotLogo } from '@/components/snack-spot-logo'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Redirect to forgot-password if there's no token in the URL
  useEffect(() => {
    if (!token) router.replace('/auth/forgot-password')
  }, [token, router])

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const json = await res.json()

      if (res.status === 429) {
        setError('Too many requests – please try again later.')
        return
      }

      if (!res.ok) {
        setError(json?.error ?? 'This reset link is invalid or has expired.')
        return
      }

      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) return null

  return (
    <div className="min-h-screen bg-gradient-to-b from-snack-surface to-snack-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mb-3">
            <SnackSpotLogo className="text-2xl" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-snack-text">Choose a new password</h2>
          <p className="text-sm text-snack-muted mt-1">Min. 8 characters, 1 uppercase, 1 number</p>
        </div>

        {done ? (
          <div className="card p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-50 dark:bg-green-950/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-snack-text">Password changed</p>
              <p className="text-sm text-snack-muted mt-1">
                Your password has been updated and all sessions have been signed out.
              </p>
            </div>
            <Link href="/auth/login" className="btn-primary inline-block w-full text-center">
              Log in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-xl border border-red-100 dark:border-red-900">
                {error}
              </div>
            )}

            <div>
              <label className="label" htmlFor="password">New password</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="label" htmlFor="confirm">Confirm new password</label>
              <input
                id="confirm"
                type="password"
                className="input"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
