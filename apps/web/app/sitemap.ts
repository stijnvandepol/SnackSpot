import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'
import { getSiteUrl } from '@/lib/site-url'
import { PILLAR_GUIDES } from '@/lib/guides'
import { photoVariantUrl } from '@/lib/photo-url'
import { getPhotoByPlace, getQualifyingCities, getQualifyingCityDishes } from '@/lib/city-index'
import { getQualifyingDishes } from '@/lib/dish-index'
import { logger } from '@/lib/logger'

// Cached for an hour via ISR so crawlers don't trigger a full places+reviews+users
// scan on every hit. getSiteUrl() is env-only (no request state), so the route is
// safely static between revalidations. (force-dynamic would have voided revalidate.)
export const revalidate = 3600

/** A profile needs this many published reviews before it earns a sitemap entry. */
const SITEMAP_MIN_REVIEWS_PER_PROFILE = 3

/**
 * When the static pages (product, guides, legal) last changed. Bump it with their copy.
 *
 * <lastmod> only helps when it is honest: Google compares it with what it finds and stops
 * trusting a site whose dates move without the content moving. Every dynamic entry below
 * therefore carries the date of its newest published review, never "now".
 */
const STATIC_CONTENT_UPDATED = new Date('2026-09-26')

/** Absolute, XML-safe image URL. Next writes <image:loc> verbatim, without escaping. */
function sitemapImage(appUrl: string, relativeUrl: string | null | undefined): string[] {
  if (!relativeUrl) return []
  return [`${appUrl}${relativeUrl}`.replace(/&/g, '&amp;')]
}

function latest(dates: Array<Date | string | null | undefined>, fallback: Date): Date {
  let newest: Date | null = null
  for (const value of dates) {
    if (!value) continue
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) continue
    if (!newest || date > newest) newest = date
  }
  return newest ?? fallback
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = getSiteUrl()

  const staticPages = [
    '/product',
    '/guides',
    '/product/releases',
    '/search',
    '/nearby',
    '/terms',
    '/privacy',
    '/subprocessors',
    '/imprint',
    ...PILLAR_GUIDES.map((guide) => guide.href),
  ]
  const staticEntries: MetadataRoute.Sitemap = staticPages.map((path) => ({
    url: `${appUrl}${path}`,
    lastModified: STATIC_CONTENT_UPDATED,
  }))
  // Hubs whose content is the review corpus; without data they fall back to the copy date.
  const fallbackEntries: MetadataRoute.Sitemap = [
    { url: appUrl, lastModified: STATIC_CONTENT_UPDATED },
    { url: `${appUrl}/snackplekken`, lastModified: STATIC_CONTENT_UPDATED },
    { url: `${appUrl}/gerechten`, lastModified: STATIC_CONTENT_UPDATED },
    ...staticEntries,
  ]

  try {
    const [placeActivity, reviews, users, cities, dishes] = await Promise.all([
      // A place page changes when a review on it does, so its date is its newest published
      // review. Only places with at least one published review are listed (no thin pages).
      prisma.review.groupBy({
        by: ['placeId'],
        where: { status: 'PUBLISHED' },
        _max: { updatedAt: true },
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
        select: {
          id: true,
          updatedAt: true,
          reviewPhotos: {
            orderBy: { sortOrder: 'asc' },
            take: 1,
            select: { photo: { select: { variants: true } } },
          },
        },
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

    // One query for the newest photo of every listed place: an image entry lets the photo
    // itself rank in Google Images, which is where a photo-review site is found first.
    const placeIds = placeActivity.map((row) => row.placeId)
    const photoByPlace = await getPhotoByPlace(placeIds)

    const placeEntries: MetadataRoute.Sitemap = placeActivity
      .map((row) => ({
        url: `${appUrl}/place/${row.placeId}`,
        lastModified: row._max.updatedAt ?? STATIC_CONTENT_UPDATED,
        images: sitemapImage(appUrl, photoByPlace.get(row.placeId)),
      }))
      .sort((a, b) => +b.lastModified - +a.lastModified)

    const reviewEntries: MetadataRoute.Sitemap = reviews.map((review) => ({
      url: `${appUrl}/review/${review.id}`,
      lastModified: review.updatedAt,
      images: sitemapImage(
        appUrl,
        photoVariantUrl(review.reviewPhotos[0]?.photo.variants as Record<string, string> | undefined, [
          'large',
          'medium',
          'thumb',
        ]),
      ),
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
      url: `${appUrl}/snackplekken/${city.slug}`,
      lastModified: latest([city.lastModified], STATIC_CONTENT_UPDATED),
    }))

    // Dish pages come from the same gate the pages themselves use, so the sitemap can
    // never advertise a /snackplekken/[stad]/[gerecht] URL that would 404. One query per
    // qualifying city, run in parallel.
    const dishesPerCity = await Promise.all(
      cities.map(async (city) => ({ city, dishes: await getQualifyingCityDishes(city.name) })),
    )
    const dishEntries: MetadataRoute.Sitemap = dishesPerCity.flatMap(({ city, dishes }) =>
      dishes.map((dish) => ({
        url: `${appUrl}/snackplekken/${city.slug}/${dish.slug}`,
        lastModified: latest([dish.lastModified], STATIC_CONTENT_UPDATED),
      })),
    )

    const nationalDishEntries: MetadataRoute.Sitemap = dishes.map((dish) => ({
      url: `${appUrl}/gerechten/${dish.slug}`,
      lastModified: latest([dish.lastModified], STATIC_CONTENT_UPDATED),
    }))

    const newestReview = latest(
      placeActivity.map((row) => row._max.updatedAt),
      STATIC_CONTENT_UPDATED,
    )
    const hubEntries: MetadataRoute.Sitemap = [
      // The homepage shows the newest reviews, so it changes when any review does.
      { url: appUrl, lastModified: newestReview },
      {
        url: `${appUrl}/snackplekken`,
        lastModified: latest(cities.map((city) => city.lastModified), STATIC_CONTENT_UPDATED),
      },
      {
        url: `${appUrl}/gerechten`,
        lastModified: latest(dishes.map((dish) => dish.lastModified), STATIC_CONTENT_UPDATED),
      },
    ]

    return [
      ...hubEntries,
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
    return fallbackEntries
  }
}
