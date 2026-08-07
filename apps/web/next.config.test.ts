import { describe, it, expect } from 'vitest'
import nextConfig from './next.config.mjs'

/**
 * Regression tests for the crawler-facing cache policy.
 *
 * Context: GSC crawl stats (Aug 2026) reported robots.txt unavailable for 1.32% of
 * requests. When Google cannot fetch robots.txt it pauses crawling the *entire host*,
 * not just that URL — so origin downtime silently costs crawl coverage sitewide.
 *
 * Live headers at the time showed `cache-control: public, max-age=0, must-revalidate`
 * on both /robots.txt (cf-cache-status: EXPIRED) and /sitemap.xml (DYNAMIC), meaning
 * neither was ever served from Cloudflare's edge. Every crawler hit reached the origin,
 * and /sitemap.xml additionally ran a full places+reviews+users scan per request.
 */

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> }

async function ruleFor(source: string): Promise<HeaderRule> {
  const rules = (await nextConfig.headers!()) as HeaderRule[]
  const rule = rules.find((r) => r.source === source)
  if (!rule) throw new Error(`No header rule declared for ${source}`)
  return rule
}

function headerValue(rule: HeaderRule, key: string): string {
  const header = rule.headers.find((h) => h.key.toLowerCase() === key.toLowerCase())
  if (!header) throw new Error(`Rule ${rule.source} does not set ${key}`)
  return header.value
}

describe.each(['/robots.txt', '/sitemap.xml'])('crawler cache policy for %s', (source) => {
  it('is cacheable at the edge so crawlers do not depend on origin availability', async () => {
    const cacheControl = headerValue(await ruleFor(source), 'Cache-Control')

    const sMaxAge = cacheControl.match(/s-maxage=(\d+)/)
    expect(sMaxAge, `${source} must set s-maxage so Cloudflare caches it`).not.toBeNull()
    expect(Number(sMaxAge![1])).toBeGreaterThan(0)
  })

  it('survives an origin outage via stale-if-error', async () => {
    const cacheControl = headerValue(await ruleFor(source), 'Cache-Control')

    // The directive that actually fixes the reported failure: on a 5xx from the
    // origin, the edge keeps serving the last good copy instead of failing the fetch.
    const staleIfError = cacheControl.match(/stale-if-error=(\d+)/)
    expect(staleIfError, `${source} must set stale-if-error`).not.toBeNull()
    // Must outlast a realistic incident — an hour of downtime should not stop crawling.
    expect(Number(staleIfError![1])).toBeGreaterThanOrEqual(86400)
  })

  it('stays public so shared caches may store it', async () => {
    const cacheControl = headerValue(await ruleFor(source), 'Cache-Control')

    expect(cacheControl).toContain('public')
    expect(cacheControl).not.toContain('no-store')
    expect(cacheControl).not.toContain('must-revalidate')
  })
})

describe('security headers still apply everywhere', () => {
  it('keeps the catch-all rule intact', async () => {
    const rule = await ruleFor('/(.*)')

    expect(headerValue(rule, 'X-Content-Type-Options')).toBe('nosniff')
    expect(headerValue(rule, 'X-Frame-Options')).toBe('DENY')
    expect(headerValue(rule, 'Content-Security-Policy')).toContain("frame-ancestors 'none'")
  })

  it('does not set Cache-Control in the catch-all, so the crawler rules cannot conflict', async () => {
    const rule = await ruleFor('/(.*)')

    expect(rule.headers.some((h) => h.key.toLowerCase() === 'cache-control')).toBe(false)
  })
})
