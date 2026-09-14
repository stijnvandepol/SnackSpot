import type { Metadata } from 'next'
import Link from 'next/link'
import { FeedTabs } from '@/components/feed-tabs'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'
import { getPublicFeedSeed } from '@/lib/feed-service'
import { getQualifyingCities, type CitySummary } from '@/lib/city-index'
import { logger } from '@/lib/logger'

// Rendered per request rather than prerendered.
//
// The feed is the content of this page, and it has to be in the HTML: as a fully
// client-rendered page this route showed a crawler one <h1> and nothing else, while
// carrying more impressions than every other page combined. ISR was the alternative,
// but `next build` has no database here (CI and both Dockerfiles pass a placeholder
// DATABASE_URL), so the prerendered copy would be the empty state — served to whichever
// crawler arrives inside the revalidate window, which is exactly the case that matters.
//
// The cost is bounded: getPublicFeedSeed() reads through Redis with a 60s TTL, so the
// database sees at most one feed query per minute regardless of traffic.
export const dynamic = 'force-dynamic'

const title = 'SnackSpot — snackbars en eettentjes, beoordeeld per gerecht'
const description =
  'Ontdek snackbars, cafetaria’s en kleine eettentjes via fotoreviews van bezoekers. Zie per zaak wat mensen er echt aten, zodat je weet wat je moet bestellen.'

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: '/' },
  openGraph: { title, description, locale: 'nl_NL' },
  twitter: { title, description },
}

/** Cities never block the page: an empty strip is better than a 500 on the homepage. */
async function getCityStrip(): Promise<CitySummary[]> {
  try {
    return await getQualifyingCities()
  } catch (error) {
    logger.error({ err: error }, 'Failed to load the homepage city strip')
    return []
  }
}

export default async function FeedPage() {
  const [seed, cities] = await Promise.all([getPublicFeedSeed(), getCityStrip()])

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <BreadcrumbJsonLd items={[]} />

      <div className="mb-6 space-y-1">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-snack-text">
          Snackbars en eettentjes, beoordeeld per gerecht
        </h1>
        <p className="text-sm text-snack-muted">
          Fotoreviews van mensen die er echt gegeten hebben. Scroll mee, of zoek de beste zaak
          bij jou in de buurt.
        </p>
      </div>

      {/*
        The homepage is the strongest internal link source on the site, and /snackbars had
        none at all — it sat in the sitemap with zero inbound links. This strip is also the
        only route to the city pages on mobile, where the bottom bar has no free slot.
      */}
      {cities.length > 0 && (
        <nav aria-labelledby="steden" className="mb-6">
          <h2
            id="steden"
            className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-snack-muted"
          >
            Snackbars per stad
          </h2>
          <ul className="flex flex-wrap gap-2">
            {cities.slice(0, 12).map((city) => (
              <li key={city.slug}>
                <Link
                  href={`/snackbars/${city.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-snack-border bg-snack-surface px-3 py-1.5 text-sm transition hover:border-snack-primary/40"
                >
                  <span className="font-medium text-snack-text">{city.name}</span>
                  <span className="text-snack-muted">{city.placeCount}</span>
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/snackbars"
                className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold text-snack-primary hover:underline"
              >
                Alle steden →
              </Link>
            </li>
          </ul>
        </nav>
      )}

      <FeedTabs seed={seed} />
    </div>
  )
}
