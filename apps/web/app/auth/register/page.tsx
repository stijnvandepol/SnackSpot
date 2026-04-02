'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { SnackSpotLogo } from '@/components/snack-spot-logo'

export default function RegisterPage() {
  const { register } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({ email: '', username: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await register(form)
    setLoading(false)
    if (!result.ok) { setError(result.error ?? 'Registration failed'); return }
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-snack-surface to-snack-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mb-3">
            <SnackSpotLogo className="text-2xl" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-snack-text">Join SnackSpot</h2>
          <p className="text-sm text-snack-muted mt-1">Create your free account</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-xl border border-red-100 dark:border-red-900">
              {error}
            </div>
          )}

          <div>
            <label className="label" htmlFor="email">Email *</label>
            <input id="email" type="email" className="input" placeholder="you@example.com"
              value={form.email} onChange={update('email')} required autoComplete="email" />
          </div>

          <div>
            <label className="label" htmlFor="username">Username * <span className="text-snack-muted font-normal">(letters, numbers, _)</span></label>
            <input id="username" type="text" className="input" placeholder="snacklover42"
              value={form.username} onChange={update('username')} required minLength={3} maxLength={30}
              pattern="^[a-zA-Z0-9_]+$" autoComplete="username" />
          </div>

          <div>
            <label className="label" htmlFor="password">Password * <span className="text-snack-muted font-normal">(min 8 chars, 1 uppercase, 1 number)</span></label>
            <input id="password" type="password" className="input" placeholder="••••••••"
              value={form.password} onChange={update('password')} required minLength={8}
              autoComplete="new-password" />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-snack-muted">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-snack-primary font-medium hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  )
}
