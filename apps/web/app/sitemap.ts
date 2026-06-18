import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'
import { getSiteUrl } from '@/lib/site-url'
import { PILLAR_GUIDES } from '@/lib/guides'
import { logger } from '@/lib/logger'

// Cached for an hour via ISR so crawlers don't trigger a full places+reviews+users
// scan on every hit. getSiteUrl() is env-only (no request state), so the route is
// safely static between revalidations. (force-dynamic would have voided revalidate.)
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = getSiteUrl()
  // Use a stable date for static pages; bump this when static content changes.
  const staticLastMod = new Date('2026-03-24')

  const staticEntries: MetadataRoute.Sitemap = [
    { url: appUrl, lastModified: new Date() },
    { url: `${appUrl}/product`, lastModified: staticLastMod },
    { url: `${appUrl}/product/guides`, lastModified: staticLastMod },
    { url: `${appUrl}/product/releases`, lastModified: staticLastMod },
    { url: `${appUrl}/search`, lastModified: staticLastMod },
    { url: `${appUrl}/nearby`, lastModified: staticLastMod },
    ...PILLAR_GUIDES.map((guide) => ({
      url: `${appUrl}${guide.href}`,
      lastModified: staticLastMod,
    })),
  ]

  try {
    const [places, reviews, users] = await Promise.all([
      // Only include places that have at least one published review — avoids thin content pages
      prisma.place.findMany({
        where: { reviews: { some: { status: 'PUBLISHED' } } },
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
    logger.error({ err: error }, 'Failed to build dynamic sitemap; returning static entries only')
    return staticEntries
  }
}
