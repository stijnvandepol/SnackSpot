import type { Metadata } from 'next'
import Link from 'next/link'
import { ReviewStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { photoVariantUrl } from '@/lib/photo-url'
import { safeJsonLd } from '@/lib/html'
import { extractCity } from '@/lib/utils'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'
import { MarketingShell } from '@/components/marketing-shell'
import { resolveLocale, getMarketingDict, ogLocale } from '@/lib/i18n/locale'
import { fillTemplate, type MarketingDict } from '@/lib/i18n/types'
import {
  getCityDishDetail,
  getQualifyingCities,
  getQualifyingCityDishes,
  type CityDishDetail,
  type CitySummary,
} from '@/lib/city-index'
import { logger } from '@/lib/logger'

// Rendered per request: resolveLocale() reads the locale cookie, and the page is built
// from live community data (the newest photos, the counts, the best-stocked dish ranking).

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale()
  const dict = getMarketingDict(locale)
  return {
    title: { absolute: dict.meta.productTitle },
    description: dict.meta.productDescription,
    alternates: { canonical: '/product' },
    openGraph: {
      type: 'website',
      title: dict.meta.productSocialTitle,
      description: dict.meta.productSocialDescription,
      locale: ogLocale(locale),
      images: ['/opengraph-image'],
    },
    twitter: {
      card: 'summary_large_image',
      title: dict.meta.productSocialTitle,
      description: dict.meta.productSocialDescription,
      images: ['/twitter-image'],
    },
  }
}

// ─── Live community data ─────────────────────────────────────────────────────

interface StripPhoto {
  id: string
  src: string
  dishName: string | null
  placeName: string
  city: string | null
  rating: number
}

interface CommunityData {
  strip: StripPhoto[]
  placesCount: number
  reviewsCount: number
  citiesCount: number
}

const EMPTY_COMMUNITY_DATA: CommunityData = { strip: [], placesCount: 0, reviewsCount: 0, citiesCount: 0 }

async function getCommunityData(): Promise<CommunityData> {
  try {
    const [recent, placesCount, reviewsCount, citiesRows] = await Promise.all([
      prisma.review.findMany({
        where: { status: ReviewStatus.PUBLISHED, reviewPhotos: { some: {} } },
        orderBy: { createdAt: 'desc' },
        take: 14,
        select: {
          id: true,
          dishName: true,
          ratingOverall: true,
          place: { select: { name: true, address: true, city: true } },
          reviewPhotos: {
            orderBy: { sortOrder: 'asc' },
            take: 1,
            select: { photo: { select: { variants: true } } },
          },
        },
      }),
      prisma.place.count(),
      prisma.review.count({ where: { status: ReviewStatus.PUBLISHED } }),
      prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(DISTINCT city)::int AS count FROM places WHERE city IS NOT NULL
      `,
    ])

    const strip = recent
      .map((r): StripPhoto | null => {
        const src = photoVariantUrl(
          r.reviewPhotos[0]?.photo.variants as Record<string, string> | undefined,
          ['medium', 'large', 'thumb'],
        )
        if (!src) return null
        return {
          id: r.id,
          src,
          dishName: r.dishName,
          placeName: r.place.name,
          city: r.place.city?.trim() || extractCity(r.place.address),
          rating: Number(r.ratingOverall),
        }
      })
      .filter((p): p is StripPhoto => p !== null)
      .slice(0, 12)

    return { strip, placesCount, reviewsCount, citiesCount: citiesRows[0]?.count ?? 0 }
  } catch (error) {
    // No database at build-time prerender (Docker image build): render the static
    // shell without the community sections rather than fail the page.
    logger.error({ err: error }, 'Failed to load community data for /product')
    return EMPTY_COMMUNITY_DATA
  }
}

/** Cities never block the page. */
async function getCities(): Promise<CitySummary[]> {
  try {
    return await getQualifyingCities()
  } catch (error) {
    logger.error({ err: error }, 'Failed to load cities for /product')
    return []
  }
}

/**
 * The best-stocked dish ranking on the site — the one output SnackSpot has that a venue
 * directory does not. Cities come best-stocked first, so the first city with a dish page
 * is the strongest example we can show.
 */
async function getShowcaseRanking(cities: CitySummary[]): Promise<CityDishDetail | null> {
  try {
    for (const city of cities.slice(0, 6)) {
      const dishes = await getQualifyingCityDishes(city.name)
      const dish = dishes[0]
      if (!dish) continue
      const detail = await getCityDishDetail(city.slug, dish.slug)
      if (detail && detail.places.length >= 2) return detail
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to load the showcase ranking for /product')
  }
  return null
}

// ─── Presentation helpers ────────────────────────────────────────────────────

function formatRating(rating: number, locale: 'nl' | 'en'): string {
  const rounded = Math.round(rating * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return locale === 'nl' ? text.replace('.', ',') : text
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating)
  return (
    <span aria-hidden="true" className="text-snack-rating">
      {'★'.repeat(full)}
      <span className="text-snack-border">{'★'.repeat(Math.max(0, 5 - full))}</span>
    </span>
  )
}

function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? one : fillTemplate(many, { n })
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function ProductPage() {
  const [community, locale, cities] = await Promise.all([getCommunityData(), resolveLocale(), getCities()])
  const ranking = await getShowcaseRanking(cities)
  const dict = getMarketingDict(locale)
  const t: MarketingDict['product'] = dict.product

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: t.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  // A count only goes on the page once it says something. Below this it reads as an apology.
  const showCounts = community.reviewsCount >= 50 && community.placesCount >= 20 && community.citiesCount >= 5

  return (
    <MarketingShell locale={locale} dict={dict}>
      <BreadcrumbJsonLd items={[{ name: 'SnackSpot', path: '/product' }]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />

      {/* ── Hero: the promise, in one sentence ─────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 md:pb-14 md:pt-24">
        <h1 className="max-w-4xl font-heading text-[2.75rem] font-bold leading-[1.02] tracking-[-0.035em] text-snack-text sm:text-6xl md:text-7xl lg:text-[5.5rem]">
          {t.heroTitle}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-snack-muted md:mt-8 md:text-xl md:leading-9">
          {t.heroLead}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center md:mt-10">
          <Link href="/auth/register?ref=hero" className="btn-primary px-6 text-base">
            {t.ctaPrimary}
          </Link>
          <Link href="/" className="btn-secondary px-6 text-base">
            {t.ctaSecondary}
          </Link>
        </div>
        <p className="mt-4 text-sm text-snack-muted">
          {t.heroFinePrint}
          {showCounts && (
            <>
              {' '}
              {fillTemplate(t.counts, {
                reviews: community.reviewsCount,
                places: community.placesCount,
                cities: community.citiesCount,
              })}
            </>
          )}
        </p>
      </section>

      {/* ── Strip: the feed made physical, running off both edges ──────────── */}
      {community.strip.length >= 4 && (
        <section aria-labelledby="strip-title" className="pb-6 md:pb-10">
          <div className="mx-auto flex max-w-6xl items-baseline justify-between px-4">
            <h2 id="strip-title" className="font-heading text-xl font-semibold text-snack-text md:text-2xl">
              {t.stripTitle}
            </h2>
            <Link href="/" className="text-sm font-semibold text-snack-primary hover:underline">
              {t.stripAll}
            </Link>
          </div>
          {/*
            Horizontal scroll with the first card aligned to the container's left edge:
            the padding-left is max(16px, (viewport − container) / 2). Cards keep the feed's
            portrait ratio so the photos read as plates, not as a banner.
          */}
          <ul
            className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-4"
            style={{ paddingLeft: 'max(1rem, calc((100vw - 72rem) / 2 + 1rem))' }}
          >
            {community.strip.map((photo, i) => (
              <li key={photo.id} className="w-[13.5rem] flex-shrink-0 snap-start sm:w-60 md:w-64">
                <Link
                  href={`/review/${photo.id}`}
                  className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-snack-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snack-primary focus-visible:ring-offset-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.src}
                    alt={photo.dishName ? `${photo.dishName}, ${photo.placeName}` : photo.placeName}
                    className="h-full w-full object-cover"
                    loading={i < 4 ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-3 pt-10 text-white">
                    <p className="truncate font-heading text-base font-semibold leading-tight">
                      {photo.dishName ?? photo.placeName}
                    </p>
                    <p className="mt-0.5 flex items-center justify-between gap-2 text-xs text-white/85">
                      <span className="truncate">
                        {photo.dishName ? photo.placeName : photo.city ?? ''}
                        {photo.dishName && photo.city ? `, ${photo.city}` : ''}
                      </span>
                      <span className="flex-shrink-0 font-semibold text-white">
                        ★ {formatRating(photo.rating, locale)}
                      </span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Ranking: the product's actual output, with real data ───────────── */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:py-24">
        <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:items-center md:gap-16">
          <div>
            <h2 className="font-heading text-3xl font-bold leading-[1.08] tracking-[-0.025em] text-snack-text md:text-5xl">
              {t.rankingTitle}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-snack-muted md:text-lg md:leading-8">
              {t.rankingBody}
            </p>
            {ranking && (
              <Link
                href={`/eettentjes/${ranking.city.slug}/${ranking.slug}`}
                className="mt-6 inline-flex text-base font-semibold text-snack-primary hover:underline"
              >
                {t.rankingLink}
              </Link>
            )}
          </div>

          {ranking ? (
            <div className="rounded-3xl bg-snack-surface p-5 md:p-7">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-heading text-xl font-bold text-snack-text md:text-2xl">
                  {fillTemplate(t.rankingCaption, { dish: ranking.name.toLowerCase(), city: ranking.city.name })}
                </h3>
                <span className="text-sm text-snack-muted">
                  {pluralize(ranking.reviewCount, t.reviewsOne, t.reviewsMany)}
                </span>
              </div>
              <ol className="mt-4 divide-y divide-snack-border">
                {ranking.places.slice(0, 4).map((place, index) => (
                  <li key={place.id}>
                    <Link
                      href={`/place/${place.id}`}
                      className="flex items-center gap-4 py-3.5 transition-colors hover:text-snack-primary"
                    >
                      <span className="w-7 flex-shrink-0 font-heading text-2xl font-bold tabular-nums text-snack-text/40">
                        {index + 1}
                      </span>
                      {place.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={place.photoUrl}
                          alt=""
                          className="h-14 w-14 flex-shrink-0 rounded-xl object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="h-14 w-14 flex-shrink-0 rounded-xl bg-snack-border" aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-heading font-semibold text-snack-text">{place.name}</span>
                        <span className="block truncate text-sm text-snack-muted">{place.address}</span>
                      </span>
                      <span className="flex-shrink-0 text-right">
                        <span className="block font-heading text-lg font-bold text-snack-text">
                          {formatRating(place.avgRating, locale)}
                        </span>
                        <Stars rating={place.avgRating} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            // Before any city clears the dish gate there is no ranking to show; the
            // strip above already carries the photos, so this column simply stays empty.
            <div aria-hidden="true" className="hidden md:block" />
          )}
        </div>
      </section>

      {/* ── Three claims, set as type ──────────────────────────────────────── */}
      <section className="border-y" style={{ borderColor: 'var(--snack-border-soft)' }}>
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-3 md:gap-12 md:py-20">
          {t.claims.map((claim) => (
            <div key={claim.title}>
              <h2 className="font-heading text-2xl font-bold leading-tight tracking-[-0.02em] text-snack-text md:text-3xl">
                {claim.title}
              </h2>
              <p className="mt-3 text-base leading-7 text-snack-muted">{claim.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works: a real sequence, so numbers are earned ───────────── */}
      <section id="hoe-het-werkt" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 md:py-24">
        <h2 className="font-heading text-3xl font-bold tracking-[-0.025em] text-snack-text md:text-5xl">
          {t.stepsTitle}
        </h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-3 md:mt-14 md:gap-10">
          {t.steps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full font-heading text-lg font-bold text-white"
                style={{ backgroundColor: 'var(--snack-primary)' }}
              >
                {index + 1}
              </span>
              <div>
                <h3 className="font-heading text-xl font-semibold leading-snug text-snack-text">{step.title}</h3>
                <p className="mt-2 text-base leading-7 text-snack-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Cities: the bold block. Giant names, each a real landing page ──── */}
      {cities.length > 0 && (
        <section className="text-white" style={{ backgroundColor: '#0F172A' }}>
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <h2 className="font-heading text-3xl font-bold tracking-[-0.025em] md:text-5xl">{t.citiesTitle}</h2>
              <p className="max-w-md text-base leading-7 text-white/70">{t.citiesBody}</p>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-4 md:mt-14 md:gap-x-12 md:gap-y-6">
              {cities.map((city) => (
                <li key={city.slug}>
                  <Link
                    href={`/eettentjes/${city.slug}`}
                    className="group inline-flex items-baseline gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#0F172A]"
                  >
                    <span className="font-heading text-3xl font-bold leading-none tracking-[-0.03em] transition-colors group-hover:text-snack-primary sm:text-4xl md:text-6xl">
                      {city.name}
                    </span>
                    <span className="text-sm text-white/55 md:text-base">
                      {pluralize(city.placeCount, t.placesOne, t.placesMany)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/eettentjes"
              className="mt-12 inline-flex min-h-[44px] items-center rounded-xl border border-white/25 px-5 text-sm font-semibold transition-colors hover:border-white hover:bg-white hover:text-snack-text"
            >
              {t.citiesAll}
            </Link>
          </div>
        </section>
      )}

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-14 md:py-24">
        <h2 className="font-heading text-3xl font-bold tracking-[-0.025em] text-snack-text md:text-4xl">{t.faqTitle}</h2>
        <div className="mt-8 divide-y divide-snack-border border-y border-snack-border">
          {t.faqs.map((faq) => (
            <details key={faq.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-heading text-lg font-semibold text-snack-text [&::-webkit-details-marker]:hidden">
                {faq.q}
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-snack-surface text-xl leading-none text-snack-muted transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-base leading-7 text-snack-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Final call ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
        <div className="rounded-3xl px-6 py-12 text-white md:px-14 md:py-16" style={{ backgroundColor: 'var(--snack-primary)' }}>
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h2 className="font-heading text-4xl font-bold leading-[1.02] tracking-[-0.03em] md:text-6xl">{t.finalTitle}</h2>
              <p className="mt-5 text-base leading-7 text-white/90 md:text-lg">{t.finalBody}</p>
            </div>
            <div className="flex-shrink-0">
              <Link
                href="/auth/register?ref=footer"
                className="inline-flex min-h-[52px] items-center justify-center rounded-xl bg-white px-7 text-base font-semibold text-snack-text shadow-sm transition hover:bg-snack-surface"
              >
                {t.finalButton}
              </Link>
              <p className="mt-3 text-sm text-white/80">{t.finalFinePrint}</p>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
