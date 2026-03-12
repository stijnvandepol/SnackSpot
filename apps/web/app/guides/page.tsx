import type { Metadata } from 'next'
import Link from 'next/link'
import { PILLAR_GUIDES } from '@/lib/guides'

export const metadata: Metadata = {
  title: 'SnackSpot Guides – Discover Hidden Gem Restaurants',
  description:
    'Explore practical SnackSpot guides for finding hidden gem restaurants, avoiding tourist traps, and discovering real local food recommendations.',
  alternates: {
    canonical: '/guides',
  },
}

export default function GuidesHubPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="max-w-3xl">
        <h1 className="font-heading text-3xl font-bold text-snack-text md:text-4xl">
          SnackSpot Guides
        </h1>
        <p className="mt-3 text-base leading-7 text-snack-muted">
          SnackSpot helps people discover hidden local food spots through real reviews, place-level context, and
          neighborhood-first exploration. These guides turn that approach into clear, repeatable workflows you can use
          to find better places to eat near you.
        </p>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {PILLAR_GUIDES.map((guide) => (
          <article key={guide.href} className="rounded-2xl border border-snack-border bg-white p-5 shadow-sm">
            <h2 className="font-heading text-xl font-semibold text-snack-text">{guide.title}</h2>
            <p className="mt-2 text-sm leading-6 text-snack-muted">{guide.description}</p>
            <Link href={guide.href} className="mt-4 inline-block text-sm font-medium text-snack-primary hover:underline">
              Read guide
            </Link>
          </article>
        ))}
      </section>
    </div>
  )
}
