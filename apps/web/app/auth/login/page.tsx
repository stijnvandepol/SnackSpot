'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Turnstile } from '@marsidev/react-turnstile'
import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { useAuth } from '@/components/auth-provider'
import { SnackSpotLogo } from '@/components/snack-spot-logo'

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance | null>(null)

  const checkCaptchaStatus = async (emailValue?: string) => {
    try {
      const url = emailValue
        ? `/api/v1/auth/captcha-required?email=${encodeURIComponent(emailValue)}`
        : '/api/v1/auth/captcha-required'
      const res = await fetch(url)
      const json = await res.json()
      if (json.data?.captchaRequired) setCaptchaRequired(true)
    } catch {
      // Fail open: if the status check errors, don't block login
    }
  }

  // Check on mount using IP only — catches IPs already flagged before page load
  useEffect(() => {
    void checkCaptchaStatus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await login(email, password, captchaToken ?? undefined)
    setLoading(false)

    if (!result.ok) {
      if (result.captchaRequired) {
        // Token was rejected (expired or replayed) — show widget and wait for a fresh token
        setCaptchaRequired(true)
        setCaptchaToken(null)
        turnstileRef.current?.reset()
        setError('Please complete the security check below to continue')
        return
      }
      setError(result.error ?? 'Login failed')
      return
    }

    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-snack-surface to-snack-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mb-3">
            <SnackSpotLogo className="text-2xl" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-snack-text">Welcome back</h2>
          <p className="text-sm text-snack-muted mt-1">Log in to your SnackSpot account</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-xl border border-red-100 dark:border-red-900">
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
              onBlur={(e) => { if (e.target.value) void checkCaptchaStatus(e.target.value) }}
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

          {captchaRequired && (
            <Turnstile
              ref={turnstileRef}
              siteKey={SITE_KEY}
              options={{ action: 'login' }}
              onSuccess={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken(null)}
            />
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading || (captchaRequired && !captchaToken)}
          >
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
