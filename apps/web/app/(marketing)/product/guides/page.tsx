import type { Metadata } from 'next'
import Link from 'next/link'
import { PILLAR_GUIDES } from '@/lib/guides'
import { GuidesShell } from '@/components/guides-shell'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'
import { resolveLocale, getMarketingDict, ogLocale } from '@/lib/i18n/locale'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale()
  const t = getMarketingDict(locale).guidesHub
  return {
    title: { absolute: t.metaTitle },
    description: t.metaDescription,
    alternates: { canonical: '/product/guides' },
    openGraph: { title: t.metaTitle, description: t.metaDescription, locale: ogLocale(locale) },
    twitter: { title: t.metaTitle, description: t.metaDescription },
  }
}

export default async function GuidesHubPage() {
  const locale = await resolveLocale()
  const dict = getMarketingDict(locale)

  return (
    <GuidesShell>
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <BreadcrumbJsonLd items={[{ name: 'Guides', path: '/product/guides' }]} />
        <header className="max-w-3xl">
          <p className="mb-3 inline-flex rounded-full border border-snack-primary/20 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-snack-primary">
            {dict.guidesHub.eyebrow}
          </p>
          <h1 className="font-heading text-3xl font-bold text-snack-text md:text-5xl">
            {dict.guidesHub.title}
          </h1>
          <p className="mt-4 text-base leading-7 text-snack-muted md:text-lg">
            {dict.guidesHub.intro}
          </p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {PILLAR_GUIDES.map((guide) => (
            <article key={guide.href} className="rounded-2xl border border-snack-border bg-white p-6 shadow-sm">
              <h2 className="font-heading text-xl font-semibold text-snack-text">{guide.title}</h2>
              <p className="mt-2 text-sm leading-6 text-snack-muted">{guide.description}</p>
              <Link href={guide.href} className="mt-4 inline-flex items-center text-sm font-semibold text-snack-primary hover:underline">
                {dict.guidesHub.readGuide}
              </Link>
            </article>
          ))}
        </section>
      </div>
    </GuidesShell>
  )
}
