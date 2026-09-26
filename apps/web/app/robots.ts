import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  const appUrl = getSiteUrl()

  // One list for everyone. A crawler obeys only the group that names it, so the AI-search
  // groups below used to carry just `Allow: /` and with it ignored every Disallow here:
  // GPTBot and friends were free to crawl /api/, /auth/ and /profile.
  const allow = ['/', '/api/v1/photos/']
  const disallow = [
    '/api/',
    '/auth/',
    '/admin/',
    '/profile',
    '/add-review',
    '/add-bite',
    // Signed-in only and not in the sitemap, but it answered 200 to anyone who
    // guessed the URL — cheaper to state the rule than to rely on obscurity.
    '/bites',
    '/review/*/edit',
  ]

  return {
    rules: [
      // Photo variants are served from /api/v1/photos/variant (see lib/photo-url.ts), so
      // a blanket /api/ disallow hid every review photo from crawlers — on a site whose
      // whole premise is photo reviews. That also broke rich results: Google needs a
      // fetchable `image`, and both the Restaurant JSON-LD and og:image point here.
      // Longest-match-wins means this Allow overrides /api/ without exposing the rest.
      { userAgent: '*', allow, disallow },
      // AI search crawlers: welcome, under the same rules. They send visitors from
      // ChatGPT, Claude and Perplexity answers.
      { userAgent: ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'], allow, disallow },
      // Training-only crawlers: no.
      { userAgent: ['CCBot', 'anthropic-ai'], disallow: '/' },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  }
}
