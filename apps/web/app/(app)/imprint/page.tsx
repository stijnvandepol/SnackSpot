import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Company Information',
  description:
    'Legal identification of the operator of SnackSpot, as required for online services in the Netherlands.',
  alternates: { canonical: '/imprint' },
}

// ─── FILL THIS IN ────────────────────────────────────────────────────────────
// Dutch/EU law requires an online service to be identifiable: the legal name of
// the operator, Chamber of Commerce (KvK) number, a contact address and email.
// Replace every value marked "TODO" with your real details before going live.
// If you operate as a sole trader (eenmanszaak) under your own name, put that as
// the legal name. A VAT (BTW) number is only required if you are VAT-registered.
const COMPANY = {
  legalName: 'TODO — your legal name or company name',
  tradeName: 'SnackSpot',
  kvk: 'TODO — your KvK (Chamber of Commerce) number',
  vat: '', // optional: 'NL000000000B00' — leave empty if not VAT-registered
  address: 'TODO — street + number, postal code, city',
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
          <Field label="KvK number" value={COMPANY.kvk} />
          {COMPANY.vat && <Field label="VAT number" value={COMPANY.vat} />}
          <Field label="Address" value={COMPANY.address} />
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
