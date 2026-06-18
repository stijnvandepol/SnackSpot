import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Sub-processors',
  description:
    'The external service providers that may process data on behalf of SnackSpot, what they do, and where they are based.',
  alternates: { canonical: '/subprocessors' },
}

// GDPR Art. 13(1)(e) transparency: the recipients/categories of recipients of
// personal data. Keep this list in sync with the services actually enabled in
// production (.env). "Conditional" entries only apply when that feature is on.
type SubProcessor = {
  name: string
  purpose: string
  data: string
  region: string
  conditional?: string
}

const SUBPROCESSORS: SubProcessor[] = [
  {
    name: 'Resend',
    purpose: 'Sending transactional and notification emails',
    data: 'Email address, username, and the contents of the message',
    region: 'United States',
  },
  {
    name: 'Cloudflare (Turnstile)',
    purpose: 'Bot and abuse protection on sign-in and sign-up',
    data: 'IP address and a verification token',
    region: 'United States',
    conditional: 'Only when the CAPTCHA challenge is enabled.',
  },
  {
    name: 'Google (Sign-in with Google)',
    purpose: 'Optional single sign-on',
    data: 'Your email address and name from your Google account, only if you choose this option',
    region: 'United States',
    conditional: 'Only if you sign in with Google.',
  },
  {
    name: 'Browser push services (Google, Mozilla, Apple)',
    purpose: 'Delivering push notifications to your device',
    data: 'A push subscription endpoint and the notification content',
    region: 'Varies by browser vendor',
    conditional: 'Only if you enable push notifications.',
  },
  {
    name: 'CARTO',
    purpose: 'Serving the background map tiles',
    data: 'Your IP address and the map area you view (sent by your browser when a map loads)',
    region: 'European Union / global',
  },
]

export default function SubprocessorsPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-snack-text">Sub-processors</h1>
        <p className="text-sm text-snack-muted mt-1">Last updated: 18 June 2026</p>
      </div>

      <div className="card p-5 space-y-3">
        <p className="text-sm text-snack-muted">
          SnackSpot runs on its own infrastructure (database, object storage and caching), but relies
          on a small number of external providers for specific features. The providers below may process
          limited personal data on our behalf under a data-processing agreement. Some only apply if you
          use the related feature. For the full picture of what we store and why, see our{' '}
          <Link href="/privacy" className="text-snack-primary hover:underline">Privacy Policy</Link>.
        </p>
        <p className="text-sm text-snack-muted">
          Where a provider is based outside the European Economic Area, transfers are covered by an
          appropriate safeguard (such as the EU&ndash;US Data Privacy Framework or Standard Contractual
          Clauses).
        </p>
      </div>

      {SUBPROCESSORS.map((sp) => (
        <div key={sp.name} className="card p-5 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading font-semibold text-snack-text">{sp.name}</h2>
            <span className="shrink-0 text-xs text-snack-muted">{sp.region}</span>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="w-28 shrink-0 text-snack-text">Purpose</dt>
              <dd className="text-snack-muted">{sp.purpose}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="w-28 shrink-0 text-snack-text">Data</dt>
              <dd className="text-snack-muted">{sp.data}</dd>
            </div>
          </dl>
          {sp.conditional && (
            <p className="text-xs italic text-snack-muted">{sp.conditional}</p>
          )}
        </div>
      ))}

      <div className="card p-5 space-y-2">
        <h2 className="font-heading font-semibold text-snack-text">Place data</h2>
        <p className="text-sm text-snack-muted">
          Venue names, addresses and map data are sourced from{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-snack-primary hover:underline">OpenStreetMap</a>{' '}
          (&copy; OpenStreetMap contributors, ODbL). Place searches are made from our servers, so your
          personal data is not shared with OpenStreetMap.
        </p>
      </div>
    </div>
  )
}
