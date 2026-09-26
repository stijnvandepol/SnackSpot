import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Bedrijfsgegevens',
  description:
    'Wie SnackSpot beheert: handelsnaam, KvK-nummer en contactgegevens, zoals verplicht voor online diensten in Nederland.',
  alternates: { canonical: '/imprint' },
}

// ─── Operator identification ─────────────────────────────────────────────────
// Dutch/EU law requires an online service to be identifiable: the trade name,
// Chamber of Commerce (KvK) number and a contact channel.
// SnackSpot is operated by a sole trader (eenmanszaak) from a home address, so
// the street address is withheld here for privacy — it is on file with the KvK
// under the number below and disclosed to authorities on legitimate request.
// A VAT (BTW) number is only shown if VAT-registered.
const COMPANY = {
  tradeName: 'SnackSpot',
  kvk: '42015984',
  vat: '', // optional: 'NL000000000B00' — leave empty if not VAT-registered
  country: 'Nederland',
  email: 'contact@snackspot.online',
} as const
// ─────────────────────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  const missing = value.startsWith('TODO')
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-40 shrink-0 text-sm font-medium text-snack-text">{label}</dt>
      <dd className={missing ? 'text-sm text-red-600 dark:text-red-400' : 'text-sm text-snack-muted'}>
        {value}
      </dd>
    </div>
  )
}

export default function ImprintPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-snack-text">Bedrijfsgegevens</h1>
        <p className="text-sm text-snack-muted mt-1">Wie deze dienst beheert</p>
      </div>

      <div className="card p-5">
        <dl className="space-y-3">
          <Field label="Dienst" value={COMPANY.tradeName} />
          <Field label="KvK-nummer" value={COMPANY.kvk} />
          {COMPANY.vat && <Field label="Btw-nummer" value={COMPANY.vat} />}
          <Field label="Land" value={COMPANY.country} />
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-40 shrink-0 text-sm font-medium text-snack-text">E-mail</dt>
            <dd className="text-sm">
              <a href={`mailto:${COMPANY.email}`} className="text-snack-primary hover:underline">
                {COMPANY.email}
              </a>
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-snack-muted">
          SnackSpot is een eenmanszaak die vanuit een woonadres wordt gerund. Om privacyredenen staat het
          adres hier niet. Het is bekend bij de Kamer van Koophandel (KvK) onder het nummer hierboven en
          wordt gedeeld met instanties en bij gegronde juridische verzoeken. Voor alle vragen kun je ons
          mailen op het e-mailadres hierboven.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">Juridische documenten</h2>
        <ul className="list-disc pl-5 text-sm text-snack-muted space-y-1">
          <li><Link href="/terms" className="text-snack-primary hover:underline">Voorwaarden</Link></li>
          <li><Link href="/privacy" className="text-snack-primary hover:underline">Privacyverklaring</Link></li>
          <li><Link href="/subprocessors" className="text-snack-primary hover:underline">Subverwerkers</Link></li>
        </ul>
      </div>

      <div className="card p-5 space-y-2">
        <h2 className="font-heading font-semibold text-snack-text">Content melden</h2>
        <p className="text-sm text-snack-muted">
          Wil je illegale content of een inbreuk op intellectueel eigendom melden, of bezwaar maken tegen
          een moderatiebesluit? Mail dan naar{' '}
          <a href={`mailto:${COMPANY.email}`} className="text-snack-primary hover:underline">{COMPANY.email}</a>.
          Je kunt losse reviews en foto&apos;s ook direct in de app melden.
        </p>
      </div>
    </div>
  )
}
