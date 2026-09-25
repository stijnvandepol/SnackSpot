import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'
import { getSiteUrl } from '@/lib/site-url'
import { PILLAR_GUIDES } from '@/lib/guides'
import { getQualifyingCities, getQualifyingCityDishes } from '@/lib/city-index'
import { getQualifyingDishes } from '@/lib/dish-index'
import { logger } from '@/lib/logger'

// Cached for an hour via ISR so crawlers don't trigger a full places+reviews+users
// scan on every hit. getSiteUrl() is env-only (no request state), so the route is
// safely static between revalidations. (force-dynamic would have voided revalidate.)
export const revalidate = 3600

/** A profile needs this many published reviews before it earns a sitemap entry. */
const SITEMAP_MIN_REVIEWS_PER_PROFILE = 3

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = getSiteUrl()
  // Use a stable date for static pages; bump this when static content changes.
  const staticLastMod = new Date('2026-06-18')

  const staticEntries: MetadataRoute.Sitemap = [
    { url: appUrl, lastModified: new Date() },
    { url: `${appUrl}/product`, lastModified: staticLastMod },
    { url: `${appUrl}/guides`, lastModified: staticLastMod },
    { url: `${appUrl}/eettentjes`, lastModified: staticLastMod },
    { url: `${appUrl}/gerechten`, lastModified: new Date() },
    { url: `${appUrl}/product/releases`, lastModified: staticLastMod },
    { url: `${appUrl}/search`, lastModified: staticLastMod },
    { url: `${appUrl}/nearby`, lastModified: staticLastMod },
    { url: `${appUrl}/terms`, lastModified: staticLastMod },
    { url: `${appUrl}/privacy`, lastModified: staticLastMod },
    { url: `${appUrl}/subprocessors`, lastModified: staticLastMod },
    { url: `${appUrl}/imprint`, lastModified: staticLastMod },
    ...PILLAR_GUIDES.map((guide) => ({
      url: `${appUrl}${guide.href}`,
      lastModified: staticLastMod,
    })),
  ]

  try {
    const [places, reviews, users, cities, dishes] = await Promise.all([
      // Only include places that have at least one published review — avoids thin content pages
      prisma.place.findMany({
        where: { reviews: { some: { status: 'PUBLISHED' } } },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      // Same quality principle as the city gate: a URL earns a place in the sitemap
      // by carrying something worth indexing. GSC crawl stats (Aug 2026) showed only
      // ~9.9% of crawls going to discovery, while reviews and profiles made up the
      // bulk of the sitemap — so crawl budget was being spent announcing one-paragraph
      // pages. Both kinds stay indexable through internal links; they just no longer
      // claim budget of their own.
      prisma.review.findMany({
        where: {
          status: 'PUBLISHED',
          reviewPhotos: { some: {} },
          dishName: { not: null },
        },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.user.findMany({
        where: {
          bannedAt: null,
          reviews: { some: { status: 'PUBLISHED' } },
        },
        select: { username: true, updatedAt: true, _count: { select: { reviews: { where: { status: 'PUBLISHED' } } } } },
        orderBy: { updatedAt: 'desc' },
      }),
      // Same source as the pages themselves, so the sitemap can never advertise a city URL
      // that would 404 — a city below the quality gate has no page at all.
      getQualifyingCities(),
      // Same gate as /gerechten/[gerecht], so no advertised dish URL can 404.
      getQualifyingDishes(),
    ])

    const placeEntries: MetadataRoute.Sitemap = places.map((place) => ({
      url: `${appUrl}/place/${place.id}`,
      lastModified: place.updatedAt,
    }))

    const reviewEntries: MetadataRoute.Sitemap = reviews.map((review) => ({
      url: `${appUrl}/review/${review.id}`,
      lastModified: review.updatedAt,
    }))

    // Prisma cannot filter on a relation count in `where`, so the threshold is applied
    // here. A profile with one or two reviews is a stub; it is still reachable from
    // every review it wrote.
    const userEntries: MetadataRoute.Sitemap = users
      .filter((user) => user._count.reviews >= SITEMAP_MIN_REVIEWS_PER_PROFILE)
      .map((user) => ({
        url: `${appUrl}/u/${encodeURIComponent(user.username)}`,
        lastModified: user.updatedAt,
      }))

    const cityEntries: MetadataRoute.Sitemap = cities.map((city) => ({
      url: `${appUrl}/eettentjes/${city.slug}`,
      lastModified: new Date(),
    }))

    // Dish pages come from the same gate the pages themselves use, so the sitemap can
    // never advertise a /eettentjes/[stad]/[gerecht] URL that would 404. One query per
    // qualifying city, and the set of qualifying cities is small by construction.
    const dishesPerCity = await Promise.all(
      cities.map(async (city) => ({ city, dishes: await getQualifyingCityDishes(city.name) })),
    )
    const dishEntries: MetadataRoute.Sitemap = dishesPerCity.flatMap(({ city, dishes }) =>
      dishes.map((dish) => ({
        url: `${appUrl}/eettentjes/${city.slug}/${dish.slug}`,
        lastModified: new Date(),
      })),
    )

    const nationalDishEntries: MetadataRoute.Sitemap = dishes.map((dish) => ({
      url: `${appUrl}/gerechten/${dish.slug}`,
      lastModified: new Date(),
    }))

    return [
      ...staticEntries,
      ...cityEntries,
      ...nationalDishEntries,
      ...dishEntries,
      ...placeEntries,
      ...reviewEntries,
      ...userEntries,
    ]
  } catch (error) {
    logger.error({ err: error }, 'Failed to build dynamic sitemap; returning static entries only')
    return staticEntries
  }
}
