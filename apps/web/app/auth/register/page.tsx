'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { SnackSpotLogo } from '@/components/snack-spot-logo'
import { GoogleSignInButton } from '@/components/google-sign-in-button'
import { authErrorNl } from '@/lib/auth-messages'
import { authHref, safeNextPath } from '@/lib/next-path'
import { track } from '@/lib/analytics'

/** Mirrors RegisterSchema in packages/shared, so people see what is missing before submitting. */
const PASSWORD_RULES: Array<{ label: string; test: (value: string) => boolean }> = [
  { label: 'minstens 8 tekens', test: (value) => value.length >= 8 },
  { label: 'een hoofdletter', test: (value) => /[A-Z]/.test(value) },
  { label: 'een cijfer', test: (value) => /[0-9]/.test(value) },
]

function RegisterContent() {
  const { register } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNextPath(searchParams.get('next'))
  const source = searchParams.get('ref')
  const [form, setForm] = useState({ email: '', username: '', password: '' })
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    track('signup_view', { source: source ?? (next !== '/' ? 'redirect' : 'direct') })
  }, [source, next])

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!agreed) {
      setError('Bevestig dat je 16 jaar of ouder bent en akkoord gaat met de voorwaarden.')
      return
    }
    setLoading(true)
    const result = await register(form)
    setLoading(false)
    if (!result.ok) {
      setError(authErrorNl(result.error, 'Account aanmaken is niet gelukt. Probeer het opnieuw.'))
      return
    }
    router.push(next)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-snack-surface to-snack-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Link href="/" aria-label="Naar de SnackSpot-homepage" className="mb-3 inline-block">
            <SnackSpotLogo className="text-2xl" />
          </Link>
          <h1 className="text-2xl font-heading font-bold text-snack-text">Maak je gratis account</h1>
          <p className="text-sm text-snack-muted mt-1">
            Deel wat je at, bewaar snackplekken voor later en help anderen kiezen wat ze bestellen.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <GoogleSignInButton label="Verder met Google" next={next} />
          {error && (
            <div
              role="alert"
              className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-xl border border-red-100 dark:border-red-900"
            >
              {error}
            </div>
          )}

          <div>
            <label className="label" htmlFor="email">E-mailadres</label>
            <input id="email" type="email" className="input" placeholder="jij@voorbeeld.nl"
              value={form.email} onChange={update('email')} required autoComplete="email"
              inputMode="email" />
          </div>

          <div>
            <label className="label" htmlFor="username">Gebruikersnaam</label>
            <input id="username" type="text" className="input" placeholder="frikandelfan"
              value={form.username} onChange={update('username')} required minLength={3} maxLength={30}
              pattern="^[a-zA-Z0-9_]+$" autoComplete="username" autoCapitalize="none"
              aria-describedby="username-hint" />
            <p id="username-hint" className="mt-1 text-xs text-snack-muted">
              3 tot 30 tekens: letters, cijfers en _. Zichtbaar bij je reviews.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="password">Wachtwoord</label>
            <input id="password" type="password" className="input" placeholder="••••••••"
              value={form.password} onChange={update('password')} required minLength={8}
              autoComplete="new-password" aria-describedby="password-rules" />
            <ul id="password-rules" className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(form.password)
                return (
                  <li key={rule.label} className={met ? 'text-green-700 dark:text-green-400' : 'text-snack-muted'}>
                    <span aria-hidden="true">{met ? '✓' : '·'}</span> {rule.label}
                    <span className="sr-only">{met ? ' (in orde)' : ' (nog niet)'}</span>
                  </li>
                )
              })}
            </ul>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-snack-muted">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-snack-primary"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              required
            />
            <span>
              Ik ben 16 jaar of ouder en ga akkoord met de{' '}
              <Link href="/terms" target="_blank" className="text-snack-primary hover:underline">voorwaarden</Link>{' '}
              en de{' '}
              <Link href="/privacy" target="_blank" className="text-snack-primary hover:underline">privacyverklaring</Link>.
            </span>
          </label>

          <button type="submit" className="btn-primary w-full" disabled={loading || !agreed}>
            {loading ? 'Account wordt aangemaakt…' : 'Account aanmaken'}
          </button>
          <p className="text-center text-xs text-snack-muted">
            Gratis, geen advertenties. Je kunt je account altijd zelf verwijderen.
          </p>
        </form>

        <p className="text-center mt-6 text-sm text-snack-muted">
          Heb je al een account?{' '}
          <Link href={authHref('login', next)} className="text-snack-primary font-medium hover:underline">Inloggen</Link>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  )
}
