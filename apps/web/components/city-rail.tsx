import Link from 'next/link'
import type { CitySummary } from '@/lib/city-index'

/**
 * One-row, horizontally scrolling list of city landing pages.
 *
 * Used on the homepage, /search and /nearby — the three routes that carry almost all
 * impressions and, before this, held no internal link to /snackplekken at all. On mobile the
 * bottom bar has no free slot for it, so this rail is the only route to the city pages
 * there.
 *
 * A single row rather than a wrapping block on purpose: the number of qualifying cities
 * grows over time, and a block would push the page's real content further down every time
 * one is added. The negative margin lets the rail bleed into the page gutter so the last
 * chip is visibly clipped — the affordance that says it scrolls.
 *
 * Server component: the links must exist in the HTML, which is the whole point.
 */
export function CityRail({
  cities,
  limit = 12,
  className = '',
}: {
  cities: CitySummary[]
  limit?: number
  className?: string
}) {
  if (cities.length === 0) return null

  return (
    <nav aria-label="Snackplekken per stad" className={className}>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cities.slice(0, limit).map((city) => (
          <li key={city.slug} className="shrink-0">
            <Link
              href={`/snackplekken/${city.slug}`}
              className="block rounded-full border border-snack-border bg-snack-surface px-3.5 py-2 text-sm font-medium text-snack-text transition hover:border-snack-primary hover:text-snack-primary"
            >
              {city.name}
            </Link>
          </li>
        ))}
        <li className="shrink-0">
          <Link
            href="/snackplekken"
            className="block rounded-full border border-dashed border-snack-border px-3.5 py-2 text-sm font-semibold text-snack-primary transition hover:border-snack-primary"
          >
            Alle steden
          </Link>
        </li>
      </ul>
    </nav>
  )
}
