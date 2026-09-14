import type { Metadata } from 'next'
import { FeedTabs } from '@/components/feed-tabs'
import { CityRail } from '@/components/city-rail'
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
    <div className="mx-auto max-w-2xl px-4 py-4 sm:py-6">
      <BreadcrumbJsonLd items={[]} />

      {/*
        Deliberately small. This is a feed: the reviews are what tell a first-time visitor
        what the app does, so the heading stays a label rather than a hero and the content
        starts within the first screen. The <h1> still carries the page's subject for
        search — it just does not need to shout it.
      */}
      <h1 className="font-heading text-lg font-bold leading-snug text-snack-text sm:text-2xl">
        Snackbars, beoordeeld per gerecht
      </h1>

      {/*
        The homepage is the strongest internal link source on the site, and /snackbars had
        none at all — it sat in the sitemap with zero inbound links.
      */}
      <CityRail cities={cities} className="mt-3" />

      <div className="mt-4">
        <FeedTabs seed={seed} />
      </div>
    </div>
  )
}
