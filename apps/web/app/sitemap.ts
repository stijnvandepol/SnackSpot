import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'
import { getSiteUrl } from '@/lib/site-url'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = getSiteUrl()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${appUrl}/feed` },
    { url: `${appUrl}/product` },
    { url: `${appUrl}/guides` },
    { url: `${appUrl}/search` },
    { url: `${appUrl}/nearby` },
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
    }))

    const reviewEntries: MetadataRoute.Sitemap = reviews.map((review) => ({
      url: `${appUrl}/review/${review.id}`,
      lastModified: review.updatedAt,
    }))

    const userEntries: MetadataRoute.Sitemap = users.map((user) => ({
      url: `${appUrl}/u/${encodeURIComponent(user.username)}`,
      lastModified: user.updatedAt,
    }))

    return [...staticEntries, ...placeEntries, ...reviewEntries, ...userEntries]
  } catch (error) {
    console.error('Failed to build dynamic sitemap; returning static entries only.', error)
    return staticEntries
  }
}
