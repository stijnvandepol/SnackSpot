import type { Metadata } from 'next'
import Link from 'next/link'
import { PILLAR_GUIDES } from '@/lib/guides'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'

const TITLE = 'Uitleg: zo gebruik je SnackSpot'
const DESCRIPTION =
  'Handleidingen voor SnackSpot: een account maken, een review plaatsen, een snackplek toevoegen, je wachtwoord wijzigen en meer.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/guides' },
  openGraph: { title: TITLE, description: DESCRIPTION },
  twitter: { title: TITLE, description: DESCRIPTION },
}

export default function GuidesHubPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
      <BreadcrumbJsonLd items={[{ name: 'Uitleg', path: '/guides' }]} />
      <header className="max-w-3xl">
        <p className="mb-3 inline-flex rounded-full border border-snack-primary/20 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-snack-primary">
          Uitleg
        </p>
        <h1 className="font-heading text-3xl font-bold text-snack-text md:text-5xl">Zo gebruik je SnackSpot</h1>
        <p className="mt-4 text-base leading-7 text-snack-muted md:text-lg">
          Stap voor stap: een account maken, je eerste review plaatsen, een snackplek toevoegen en je account
          beheren.
        </p>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {PILLAR_GUIDES.map((guide) => (
          <article key={guide.href} className="rounded-2xl border border-snack-border bg-white p-6 shadow-sm">
            <h2 className="font-heading text-xl font-semibold text-snack-text">{guide.title}</h2>
            <p className="mt-2 text-sm leading-6 text-snack-muted">{guide.description}</p>
            <Link
              href={guide.href}
              className="mt-4 inline-flex items-center text-sm font-semibold text-snack-primary hover:underline"
            >
              Lees de handleiding
            </Link>
          </article>
        ))}
      </section>
    </div>
  )
}
