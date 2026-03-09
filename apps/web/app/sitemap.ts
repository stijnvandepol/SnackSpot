import type { MetadataRoute } from 'next'

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:8080'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${appUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ]
}
