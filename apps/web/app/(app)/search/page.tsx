import { SearchClient } from './search-client'
import { CityRail } from '@/components/city-rail'
import { getQualifyingCities, type CitySummary } from '@/lib/city-index'
import { logger } from '@/lib/logger'

// This route used to be a single 'use client' component, so a crawler received an empty
// shell. The heading and the city links below are rendered on the server; the search box,
// the tag filter and the default place list stay in the client component.
//
// Note there is deliberately no server-rendered place list here: SearchClient already
// renders one in its default state, and a second list of the same venues sorted slightly
// differently read as a duplicate — and on a phone it pushed the page to roughly twice
// its useful length. The crawlable value of this page is the city links, which lead to
// /eettentjes/[stad]; being a venue directory is the job of those pages, not this one.
export const dynamic = 'force-dynamic'

async function getCities(): Promise<CitySummary[]> {
  try {
    return await getQualifyingCities()
  } catch (error) {
    logger.error({ err: error }, 'Failed to load cities for /search')
    return []
  }
}

export default async function SearchPage() {
  const cities = await getCities()

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-heading text-xl font-bold leading-snug text-snack-text sm:text-2xl">
        Ontdek eettentjes
      </h1>
      <p className="mt-1 text-sm text-snack-muted">
        Zoek op naam, gerecht of label — of begin bij een stad.
      </p>

      <CityRail cities={cities} className="mt-4" />

      <div className="mt-5">
        <SearchClient />
      </div>
    </div>
  )
}
