import { describe, it, expect } from 'vitest'
import robots from './robots'

/**
 * Every photo on the site is served from /api/v1/photos/variant?key=… (see
 * lib/photo-url.ts). A blanket `Disallow: /api/` therefore blocked crawlers from every
 * review photo on a site whose entire premise is photo reviews.
 *
 * Fallout observed in GSC (Aug 2026): the Search Appearance report was completely empty
 * — no rich results at all — despite valid Restaurant + AggregateRating + BreadcrumbList
 * markup on place pages. Google requires a fetchable `image`, and both the JSON-LD
 * `image` and `og:image` pointed at the blocked path.
 *
 * Per the robots.txt spec the most specific (longest) matching rule wins, so an explicit
 * Allow for the photo endpoint overrides the broader Disallow without opening up /api/.
 */

const PHOTO_ENDPOINT = '/api/v1/photos/'

function generalRule() {
  const rule = robots().rules
  const rules = Array.isArray(rule) ? rule : [rule]
  const general = rules.find((r) => r.userAgent === '*')
  if (!general) throw new Error('No wildcard user-agent rule found')
  return general
}

function asList(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

describe('robots.txt photo access', () => {
  it('allows crawlers to fetch photo variants', () => {
    const allow = asList(generalRule().allow)

    expect(
      allow.some((path) => path.startsWith(PHOTO_ENDPOINT)),
      'photo variants must be explicitly allowed or rich results stay disqualified',
    ).toBe(true)
  })

  it('grants the photo endpoint a longer match than the /api/ disallow', () => {
    const rule = generalRule()
    const photoAllow = asList(rule.allow).find((p) => p.startsWith(PHOTO_ENDPOINT))!
    const apiDisallow = asList(rule.disallow).find((p) => '/api/'.startsWith(p) || p === '/api/')!

    // Longest-match-wins: the Allow only takes effect while it is more specific.
    expect(photoAllow.length).toBeGreaterThan(apiDisallow.length)
  })

  it('still blocks the rest of the API surface', () => {
    const disallow = asList(generalRule().disallow)

    expect(disallow).toContain('/api/')
  })

  it('keeps private and mutating routes blocked', () => {
    const disallow = asList(generalRule().disallow)

    for (const path of ['/auth/', '/admin/', '/profile', '/add-review', '/review/*/edit']) {
      expect(disallow).toContain(path)
    }
  })

  it('still points at the sitemap', () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/)
  })
})
