'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (!result.ok) {
      setError(result.error ?? 'Login failed')
      return
    }
    router.push('/')
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
          <h2 className="text-2xl font-heading font-bold text-snack-text">Welcome back</h2>
          <p className="text-sm text-snack-muted mt-1">Log in to your SnackSpot account</p>
        </div>

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

          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <div className="text-center mt-6 space-y-2 text-sm">
          <p className="text-snack-muted">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="text-snack-primary font-medium hover:underline">Sign up</Link>
          </p>
          <Link href="/auth/forgot-password" className="text-snack-muted hover:text-snack-text">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  )
}
