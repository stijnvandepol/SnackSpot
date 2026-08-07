import { describe, it, expect } from 'vitest'
import { config } from './middleware'

/**
 * The middleware matcher decides which requests Next.js routes through middleware.
 *
 * Running middleware on a path makes Next.js attach RSC routing headers to the
 * response: `vary: rsc, next-router-state-tree, next-router-prefetch, ...`. Cloudflare
 * cannot normalise those, so it refuses to cache the response — observed live in Aug 2026
 * as `cf-cache-status: DYNAMIC` on /sitemap.xml and `EXPIRED` on /robots.txt.
 *
 * Consequences: every crawler fetch reached the origin, each sitemap fetch ran a full
 * places+reviews+users scan, and origin downtime made robots.txt unfetchable — which
 * Google treats as a reason to pause crawling the entire host.
 *
 * Excluding these paths is safe because none of them derive content from the Host
 * header: lib/site-url.ts resolves URLs from NEXT_PUBLIC_APP_URL only, so skipping the
 * ALLOWED_HOSTS guard here cannot enable host-header injection. Static assets under
 * /_next/static are content-addressed and host-independent by construction.
 */

/** Convert the Next.js matcher into a RegExp so we can assert what it does and does not cover. */
function matches(pathname: string): boolean {
  return config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(pathname))
}

describe('middleware matcher', () => {
  it.each([
    ['/robots.txt', 'crawl directives must stay edge-cacheable'],
    ['/sitemap.xml', 'each uncached fetch triggers a full DB scan'],
    ['/manifest.webmanifest', 'static PWA manifest'],
    ['/favicon.ico', 'static icon'],
    ['/_next/static/chunks/webpack-2a84427dd2a9ee9f.js', 'immutable content-addressed bundle'],
    ['/_next/image', 'image optimiser output'],
  ])('skips %s (%s)', (pathname) => {
    expect(matches(pathname)).toBe(false)
  })

  it.each([
    ['/', 'homepage'],
    ['/api/v1/reviews', 'CORS headers are applied here'],
    ['/place/0d0e3708-c40b-43f1-b833-1463b312d7c2', 'place page'],
    ['/nearby', 'app route'],
    ['/admin/moderation', 'admin route'],
    ['/_next/data/build/index.json', 'data route is not a static asset'],
  ])('still covers %s (%s)', (pathname) => {
    expect(matches(pathname)).toBe(true)
  })

  it('keeps the ALLOWED_HOSTS guard on every route that renders host-sensitive content', () => {
    // Auth flows are the classic host-header injection target (poisoned reset links),
    // so they must never be excluded from the matcher.
    expect(matches('/auth/reset-password')).toBe(true)
    expect(matches('/api/v1/auth/google/callback')).toBe(true)
  })
})
