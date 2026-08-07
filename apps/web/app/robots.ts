import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  const appUrl = getSiteUrl()

  return {
    rules: [
      {
        userAgent: '*',
        // Photo variants are served from /api/v1/photos/variant (see lib/photo-url.ts), so
        // a blanket /api/ disallow hid every review photo from crawlers — on a site whose
        // whole premise is photo reviews. That also broke rich results: Google needs a
        // fetchable `image`, and both the Restaurant JSON-LD and og:image point here.
        // Longest-match-wins means this Allow overrides /api/ without exposing the rest.
        allow: ['/', '/api/v1/photos/'],
        disallow: ['/api/', '/auth/', '/admin/', '/profile', '/add-review', '/review/*/edit'],
      },
      // Allow AI search crawlers explicitly
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      // Block AI training-only crawlers
      { userAgent: 'CCBot', disallow: '/' },
      { userAgent: 'anthropic-ai', disallow: '/' },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  }
}
