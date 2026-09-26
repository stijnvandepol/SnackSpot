import type { Metadata } from 'next'
import Link from 'next/link'
import { getQualifyingCities } from '@/lib/city-index'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'

// Rendered per request rather than prerendered at build time.
//
// This is a static route, so Next.js would prerender it during `next build` — but the build
// has no database: CI and both Dockerfiles supply a placeholder DATABASE_URL. Catching the
// error and prerendering the empty state instead (the approach app/sitemap.ts takes, where
// a file must exist either way) would leave this hub advertising "no city complete enough"
// for up to a revalidate window after every deploy, exactly when a crawler might read it.
//
// The cost is one indexed GROUP BY per request, which is the cheaper side of that trade.
export const dynamic = 'force-dynamic'

const TITLE = 'Snackplekken per stad'
const DESCRIPTION =
  'Per stad de snackbars, cafetaria\'s en frituren op SnackSpot, gerangschikt op reviews van bezoekers. Met cijfers, foto\'s en de gerechten die ze bestelden.'

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | SnackSpot` },
  description: DESCRIPTION,
  alternates: { canonical: '/snackplekken' },
  openGraph: { type: 'website', title: TITLE, description: DESCRIPTION, locale: 'nl_NL' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

export default async function SnackplekkenIndexPage() {
  const cities = await getQualifyingCities()

  return (
    <div lang="nl" className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <BreadcrumbJsonLd items={[{ name: 'Snackplekken', path: '/snackplekken' }]} />

      <header className="max-w-3xl">
        <h1 className="font-heading text-3xl font-bold text-snack-text md:text-5xl">
          Snackplekken per stad
        </h1>
        <p className="mt-4 text-base leading-7 text-snack-muted md:text-lg">
          Per stad de snackplekken met reviews, gerangschikt op het cijfer dat bezoekers gaven.
          De volgorde komt alleen uit reviews: geen advertenties en geen gesponsorde plekken.
        </p>
      </header>

      {cities.length > 0 ? (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {cities.map((city) => (
            <li key={city.slug}>
              <Link
                href={`/snackplekken/${city.slug}`}
                className="block rounded-2xl border border-snack-border bg-snack-background p-6 shadow-sm transition hover:border-snack-primary/40"
              >
                <h2 className="font-heading text-xl font-semibold text-snack-text">{city.name}</h2>
                <p className="mt-1 text-sm text-snack-muted">
                  {city.placeCount === 1 ? '1 snackplek' : `${city.placeCount} snackplekken`} ·{' '}
                  {city.reviewCount === 1 ? '1 review' : `${city.reviewCount} reviews`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        // Expected while the corpus is small: a city needs several places and a body of
        // reviews before its page carries enough to be worth reading. Say so plainly rather
        // than shipping an empty grid.
        <section className="mt-8 rounded-2xl border border-snack-border bg-snack-surface p-6">
          <h2 className="font-heading text-lg font-semibold text-snack-text">
            Nog geen steden met genoeg reviews
          </h2>
          <p className="mt-2 text-sm leading-6 text-snack-muted">
            Een stad krijgt een eigen pagina zodra er genoeg snackplekken en reviews zijn voor een
            eerlijke ranglijst. Schrijf een review van een snackplek die je kent.
          </p>
          <Link href="/add-review" className="btn-primary mt-4 inline-flex text-sm">
            Schrijf een review
          </Link>
        </section>
      )}
    </div>
  )
}
