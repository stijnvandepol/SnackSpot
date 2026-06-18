import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Company Information',
  description:
    'Legal identification of the operator of SnackSpot, as required for online services in the Netherlands.',
  alternates: { canonical: '/imprint' },
}

// ─── Operator identification ─────────────────────────────────────────────────
// Dutch/EU law requires an online service to be identifiable: the trade name,
// legal form, Chamber of Commerce (KvK) number and a contact channel.
// SnackSpot is operated by a sole trader (eenmanszaak) from a home address, so
// the street address is withheld here for privacy — it is on file with the KvK
// under the number below and disclosed to authorities on legitimate request.
// A VAT (BTW) number is only shown if VAT-registered.
const COMPANY = {
  legalName: 'Stijn IT',
  legalForm: 'Sole trader (eenmanszaak) — website & software development',
  tradeName: 'SnackSpot',
  kvk: '42015984',
  establishment: '000065194454', // Vestigingsnummer
  vat: '', // optional: 'NL000000000B00' — leave empty if not VAT-registered
  country: 'The Netherlands',
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
        <h1 className="font-heading font-bold text-2xl text-snack-text">Company Information</h1>
        <p className="text-sm text-snack-muted mt-1">Who operates this service</p>
      </div>

      <div className="card p-5">
        <dl className="space-y-3">
          <Field label="Service" value={COMPANY.tradeName} />
          <Field label="Operated by" value={COMPANY.legalName} />
          <Field label="Legal form" value={COMPANY.legalForm} />
          <Field label="KvK number" value={COMPANY.kvk} />
          <Field label="Establishment no." value={COMPANY.establishment} />
          {COMPANY.vat && <Field label="VAT number" value={COMPANY.vat} />}
          <Field label="Country" value={COMPANY.country} />
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-40 shrink-0 text-sm font-medium text-snack-text">Email</dt>
            <dd className="text-sm">
              <a href={`mailto:${COMPANY.email}`} className="text-snack-primary hover:underline">
                {COMPANY.email}
              </a>
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-snack-muted">
          SnackSpot is operated as a sole trader from a private residence. The registered address is
          withheld here for privacy; it is held by the Dutch Chamber of Commerce (KvK) under the number
          above and is disclosed to authorities and for legitimate legal requests. For any matter,
          contact us at the email below.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">Legal documents</h2>
        <ul className="list-disc pl-5 text-sm text-snack-muted space-y-1">
          <li><Link href="/terms" className="text-snack-primary hover:underline">Terms of Service</Link></li>
          <li><Link href="/privacy" className="text-snack-primary hover:underline">Privacy Policy</Link></li>
          <li><Link href="/subprocessors" className="text-snack-primary hover:underline">Sub-processors</Link></li>
        </ul>
      </div>

      <div className="card p-5 space-y-2">
        <h2 className="font-heading font-semibold text-snack-text">Reporting content</h2>
        <p className="text-sm text-snack-muted">
          To report illegal content, an intellectual-property infringement, or to object to a
          moderation decision, email{' '}
          <a href={`mailto:${COMPANY.email}`} className="text-snack-primary hover:underline">{COMPANY.email}</a>.
          You can also report individual reviews and photos directly in the app.
        </p>
      </div>
    </div>
  )
}
