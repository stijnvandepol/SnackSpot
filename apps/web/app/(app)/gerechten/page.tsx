import type { Metadata } from 'next'
import Link from 'next/link'
import { getQualifyingDishes } from '@/lib/dish-index'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'

// Per request for the same reason as /snackplekken: `next build` has no database, and a
// prerendered empty hub would be what crawlers see after every deploy. The dish list itself
// is cached in Redis (lib/dish-index.ts), so this costs one cache read.
export const dynamic = 'force-dynamic'

const TITLE = 'Gerechten, beoordeeld per snackplek'
const DESCRIPTION =
  'Van frikandel speciaal tot kapsalon: bekijk per gerecht welke snackplekken bezoekers het hoogst beoordeelden, met cijfers en foto\'s uit hun reviews.'

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | SnackSpot` },
  description: DESCRIPTION,
  alternates: { canonical: '/gerechten' },
  openGraph: { type: 'website', title: TITLE, description: DESCRIPTION, locale: 'nl_NL' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

export default async function GerechtenIndexPage() {
  const dishes = await getQualifyingDishes()

  return (
    <div lang="nl" className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <BreadcrumbJsonLd items={[{ name: 'Gerechten', path: '/gerechten' }]} />

      <header className="max-w-3xl">
        <h1 className="font-heading text-3xl font-bold text-snack-text md:text-5xl">Reviews per gerecht</h1>
        <p className="mt-4 text-base leading-7 text-snack-muted md:text-lg">
          Hier staan snackplekken per gerecht gerangschikt, op het cijfer voor dat gerecht en niet op het totaalcijfer.
          Een snackbar met een gemiddeld totaalcijfer kan zo toch bovenaan staan voor kapsalon. De volgorde komt alleen
          uit reviews van bezoekers, zonder gesponsorde plekken.
        </p>
      </header>

      {dishes.length > 0 ? (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dishes.map((dish) => (
            <li key={dish.slug}>
              <Link
                href={`/gerechten/${dish.slug}`}
                className="block h-full rounded-2xl border border-snack-border bg-snack-background p-5 shadow-sm transition hover:border-snack-primary/40"
              >
                <h2 className="font-heading text-lg font-semibold text-snack-text">{dish.name}</h2>
                <p className="mt-1 text-sm text-snack-muted">
                  ★ {dish.avgRating.toFixed(1).replace('.', ',')} gemiddeld · {dish.placeCount} snackplekken · {dish.reviewCount} reviews
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <section className="mt-8 rounded-2xl border border-snack-border bg-snack-surface p-6">
          <h2 className="font-heading text-lg font-semibold text-snack-text">Nog geen gerecht met genoeg reviews</h2>
          <p className="mt-2 text-sm leading-6 text-snack-muted">
            Een gerecht krijgt een eigen ranglijst zodra het bij minstens twee snackplekken is beoordeeld. Vul bij je
            review in wat je bestelde, dan telt het mee.
          </p>
          <Link href="/add-review" className="btn-primary mt-4 inline-flex text-sm">
            Schrijf een review
          </Link>
        </section>
      )}

      <p className="mt-10 text-sm text-snack-muted">
        Liever per stad zoeken?{' '}
        <Link href="/snackplekken" className="font-semibold text-snack-primary hover:underline">
          Bekijk snackplekken per stad
        </Link>
        .
      </p>
    </div>
  )
}
