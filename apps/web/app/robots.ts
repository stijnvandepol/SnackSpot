import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  const appUrl = getSiteUrl()

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/feed', '/search', '/nearby', '/product', '/place/', '/review/', '/u/'],
        disallow: ['/api/', '/auth/', '/admin/', '/profile', '/add-review', '/review/*/edit'],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  }
}
