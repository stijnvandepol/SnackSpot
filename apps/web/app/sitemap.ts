import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'
import { getSiteUrl } from '@/lib/site-url'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = getSiteUrl()
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${appUrl}/guides`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${appUrl}/guides/hidden-gem-restaurants-near-me`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${appUrl}/guides/how-to-find-underrated-restaurants`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${appUrl}/guides/how-to-avoid-tourist-trap-restaurants`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${appUrl}/guides/how-to-find-restaurants-by-vibe`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${appUrl}/guides/how-to-spot-fake-restaurant-reviews`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${appUrl}/guides/add-snackspot-to-home-screen`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${appUrl}/product`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${appUrl}/feed`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${appUrl}/search`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${appUrl}/nearby`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    },
  ]

  try {
    const [places, reviews, users] = await Promise.all([
      prisma.place.findMany({
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.review.findMany({
        where: { status: 'PUBLISHED' },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.user.findMany({
        where: { bannedAt: null },
        select: { username: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ])

    const placeEntries: MetadataRoute.Sitemap = places.map((place) => ({
      url: `${appUrl}/place/${place.id}`,
      lastModified: place.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.7,
    }))

    const reviewEntries: MetadataRoute.Sitemap = reviews.map((review) => ({
      url: `${appUrl}/review/${review.id}`,
      lastModified: review.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

    const userEntries: MetadataRoute.Sitemap = users.map((user) => ({
      url: `${appUrl}/u/${encodeURIComponent(user.username)}`,
      lastModified: user.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.6,
    }))

    return [...staticEntries, ...placeEntries, ...reviewEntries, ...userEntries]
  } catch (error) {
    console.error('Failed to build dynamic sitemap; returning static entries only.', error)
    return staticEntries
  }
}
