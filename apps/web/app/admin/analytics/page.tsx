'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'

interface DailyCounts {
  date: string
  counts: Record<string, number>
}

interface AnalyticsResponse {
  days: DailyCounts[]
  totals: Record<string, number>
}

/** Funnel steps in order, each with the step it is measured against. */
const FUNNEL: Array<{ event: string; label: string; from?: string }> = [
  { event: 'place_view', label: 'Zaak bekeken' },
  { event: 'signup_view', label: 'Registratiepagina bekeken' },
  { event: 'signup_completed', label: 'Account aangemaakt', from: 'signup_view' },
  { event: 'review_started', label: 'Review gestart' },
  { event: 'review_created', label: 'Review geplaatst', from: 'review_started' },
  { event: 'first_review_created', label: 'Eerste review van een nieuwe gebruiker', from: 'signup_completed' },
  { event: 'place_saved', label: 'Zaak bewaard' },
  { event: 'share_clicked', label: 'Gedeeld' },
  { event: 'search_performed', label: 'Gezocht' },
  { event: 'nearby_used', label: '"Dichtbij" gebruikt' },
  { event: 'city_page_view', label: 'Stadspagina bekeken' },
  { event: 'dish_page_view', label: 'Gerechtpagina bekeken' },
  { event: 'login_completed', label: 'Ingelogd' },
  { event: 'report_submitted', label: 'Melding gedaan' },
]

const VITALS = ['LCP', 'INP', 'CLS'] as const

function sumField(days: DailyCounts[], field: string): number {
  return days.reduce((total, day) => total + (day.counts[field] ?? 0), 0)
}

function percent(part: number, whole: number): string {
  if (whole === 0) return '–'
  return `${Math.round((part / whole) * 100)}%`
}

export default function AnalyticsPage() {
  const { user, accessToken } = useAuth()
  const [range, setRange] = useState(28)
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || user?.role !== 'ADMIN') return
    let cancelled = false
    setError(null)
    fetch(`/api/v1/admin/analytics?days=${range}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => { if (!cancelled) setData(json.data) })
      .catch(() => { if (!cancelled) setError('Kon de cijfers niet laden.') })
    return () => { cancelled = true }
  }, [accessToken, user?.role, range])

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="font-semibold text-snack-text">Deze pagina is alleen voor admins.</p>
        <Link href="/" className="btn-primary mt-4 inline-block">Naar de feed</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-heading text-2xl font-bold text-snack-text">Funnel</h1>
      <p className="mt-1 text-sm text-snack-muted">
        Anonieme dagtellingen: geen cookies, geen IP-adressen, geen gebruikers-id&apos;s. Adblockers
        missen client-events; aanmeldingen, logins en reviews worden server-side geteld en zijn exact.
      </p>

      <label className="mt-4 inline-flex items-center gap-2 text-sm text-snack-text">
        Periode
        <select className="input w-auto py-1" value={range} onChange={(e) => setRange(Number(e.target.value))}>
          <option value={7}>7 dagen</option>
          <option value={28}>28 dagen</option>
          <option value={90}>90 dagen</option>
        </select>
      </label>

      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="mt-6 text-sm text-snack-muted">Laden…</p>}

      {data && (
        <>
          <section className="mt-6" aria-labelledby="funnel-heading">
            <h2 id="funnel-heading" className="font-heading text-lg font-semibold text-snack-text">Stappen</h2>
            <table className="mt-2 w-full text-left text-sm">
              <thead className="text-snack-muted">
                <tr>
                  <th className="py-1 font-medium">Stap</th>
                  <th className="py-1 text-right font-medium">Aantal</th>
                  <th className="py-1 text-right font-medium">Conversie</th>
                </tr>
              </thead>
              <tbody>
                {FUNNEL.map((step) => {
                  const count = data.totals[step.event] ?? 0
                  return (
                    <tr key={step.event} className="border-t border-snack-border">
                      <td className="py-1.5 text-snack-text">{step.label}</td>
                      <td className="py-1.5 text-right tabular-nums text-snack-text">{count}</td>
                      <td className="py-1.5 text-right tabular-nums text-snack-muted">
                        {step.from ? percent(count, data.totals[step.from] ?? 0) : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          <section className="mt-8" aria-labelledby="vitals-heading">
            <h2 id="vitals-heading" className="font-heading text-lg font-semibold text-snack-text">
              Core Web Vitals (echte bezoekers)
            </h2>
            <p className="mt-1 text-xs text-snack-muted">Doel: minstens 75% &quot;goed&quot; per metric.</p>
            <ul className="mt-2 grid grid-cols-3 gap-3">
              {VITALS.map((metric) => {
                const good = sumField(data.days, `web_vital|${metric}:good`)
                const total =
                  good +
                  sumField(data.days, `web_vital|${metric}:needs-improvement`) +
                  sumField(data.days, `web_vital|${metric}:poor`)
                return (
                  <li key={metric} className="card p-3 text-center">
                    <p className="text-xs font-medium text-snack-muted">{metric}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-snack-text">{percent(good, total)}</p>
                    <p className="text-xs text-snack-muted">goed · n={total}</p>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="mt-8" aria-labelledby="daily-heading">
            <h2 id="daily-heading" className="font-heading text-lg font-semibold text-snack-text">Per dag</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-snack-muted">
                  <tr>
                    <th className="py-1 font-medium">Datum</th>
                    <th className="py-1 text-right font-medium">Zaken bekeken</th>
                    <th className="py-1 text-right font-medium">Accounts</th>
                    <th className="py-1 text-right font-medium">Reviews</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.days].reverse().map((day) => (
                    <tr key={day.date} className="border-t border-snack-border">
                      <td className="py-1 tabular-nums text-snack-text">{day.date}</td>
                      {['place_view', 'signup_completed', 'review_created'].map((event) => (
                        <td key={event} className="py-1 text-right tabular-nums text-snack-text">
                          {Object.entries(day.counts)
                            .filter(([field]) => field === event || field.startsWith(`${event}|`))
                            .reduce((total, [, value]) => total + value, 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
