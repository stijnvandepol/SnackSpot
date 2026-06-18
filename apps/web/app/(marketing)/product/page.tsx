import type { Metadata } from 'next'
import Link from 'next/link'
import { ReviewStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { photoVariantUrl } from '@/lib/photo-url'
import { safeJsonLd } from '@/lib/html'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'
import { MarketingShell } from '@/components/marketing-shell'
import { resolveLocale, getMarketingDict } from '@/lib/i18n/locale'

// Marketing page with live community data — re-rendered every 5 minutes.
export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const dict = getMarketingDict(await resolveLocale())
  return {
    title: { absolute: dict.meta.productTitle },
    description: dict.meta.productDescription,
    alternates: {
      canonical: '/product',
    },
    openGraph: {
      type: 'website',
      title: dict.meta.productTitle,
      description: dict.meta.productDescription,
      images: ['/opengraph-image'],
    },
    twitter: {
      card: 'summary_large_image',
      title: dict.meta.productTitle,
      description: dict.meta.productDescription,
      images: ['/twitter-image'],
    },
  }
}

// ─── Live community data (honest social proof, thresholds per CRO doc) ───────

interface WallPhoto {
  id: string
  src: string
  dishName: string | null
  rating: number
}

const EMPTY_COMMUNITY_DATA = {
  wall: [] as WallPhoto[],
  placesCount: 0,
  citiesCount: 0,
  photosThisWeek: 0,
}

async function getCommunityData() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  try {
    const [recentReviews, placesCount, citiesRows, photosThisWeek] = await Promise.all([
      prisma.review.findMany({
        where: { status: ReviewStatus.PUBLISHED, reviewPhotos: { some: {} } },
        orderBy: { createdAt: 'desc' },
        take: 16,
        select: {
          id: true,
          dishName: true,
          ratingOverall: true,
          reviewPhotos: {
            orderBy: { sortOrder: 'asc' },
            take: 1,
            select: { photo: { select: { variants: true } } },
          },
        },
      }),
      prisma.place.count(),
      prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(DISTINCT city)::int AS count FROM places WHERE city IS NOT NULL
      `,
      prisma.photo.count({ where: { createdAt: { gte: weekAgo }, moderationStatus: 'APPROVED' } }),
    ])

    const wall: WallPhoto[] = recentReviews
      .map((r) => {
        const src = photoVariantUrl(
          r.reviewPhotos[0]?.photo.variants as Record<string, string> | undefined,
          ['medium', 'thumb', 'large'],
        )
        if (!src) return null
        return { id: r.id, src, dishName: r.dishName, rating: Number(r.ratingOverall) }
      })
      .filter((p): p is WallPhoto => p !== null)
      .slice(0, 12)

    return {
      wall,
      placesCount,
      citiesCount: citiesRows[0]?.count ?? 0,
      photosThisWeek,
    }
  } catch {
    // No database at build-time prerender (Docker image build) — render the
    // static shell with fallbacks; ISR fills in live data at runtime.
    return EMPTY_COMMUNITY_DATA
  }
}

export default async function ProductPage() {
  const [{ wall, placesCount, citiesCount, photosThisWeek }, locale] = await Promise.all([
    getCommunityData(),
    resolveLocale(),
  ])
  const dict = getMarketingDict(locale)

  // A number only goes on the page when it impresses without context.
  const stats = [
    placesCount >= 10 ? { value: placesCount, label: 'Hidden gems on the map' } : null,
    citiesCount >= 2 ? { value: citiesCount, label: 'Cities with at least one gem' } : null,
    photosThisWeek >= 25 ? { value: photosThisWeek, label: 'Photos shared this week' } : null,
  ].filter((s): s is { value: number; label: string } => s !== null)

  // FAQ JSON-LD uses dict.faqs so it localizes with the rest.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: dict.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  const heroWall = wall.slice(0, 5)

  return (
    <MarketingShell locale={locale} dict={dict}>
      <BreadcrumbJsonLd items={[{ name: 'About SnackSpot', path: '/product' }]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-20">
        <div>
          <p className="mb-4 inline-flex rounded-full border border-snack-primary/20 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-snack-primary">
            {dict.hero.eyebrow}
          </p>
          <h1 className="max-w-3xl font-heading text-5xl font-bold leading-tight text-snack-text md:text-7xl">
            {dict.hero.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-snack-muted md:text-lg">
            {dict.hero.subtitle}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/auth/register?ref=hero" className="btn-primary text-sm">
              {dict.hero.ctaPrimary}
            </Link>
            <Link href="/" className="btn-secondary text-sm">
              {dict.hero.ctaSecondary}
            </Link>
          </div>
          <p className="mt-3 text-xs text-snack-muted">
            {dict.hero.finePrint}
          </p>
        </div>

        {/* Real community photos beat any mockup; emoji tiles cover the cold start. */}
        <div className="grid grid-cols-3 gap-3">
          {heroWall.length >= 3
            ? heroWall.map((photo, i) => (
                <div
                  key={photo.id}
                  className={`relative overflow-hidden rounded-2xl bg-snack-surface shadow-sm ${
                    i === 0 ? 'col-span-2 row-span-2' : ''
                  } aspect-square`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.src}
                    alt={photo.dishName ?? 'Food photo shared on SnackSpot'}
                    className="h-full w-full object-cover"
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                  {i === 0 && photo.dishName && (
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
                      ★ {photo.rating.toFixed(1)}, {photo.dishName}
                    </span>
                  )}
                </div>
              ))
            : ['🍜', '🍕', '🥐', '🌮', '🍤'].map((emoji, i) => (
                <div
                  key={emoji}
                  className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-snack-primary/15 to-snack-accent/15 ${
                    i === 0 ? 'col-span-2 row-span-2 text-8xl' : 'text-5xl'
                  } aspect-square`}
                  aria-hidden="true"
                >
                  {emoji}
                </div>
              ))}
        </div>
      </section>

      {/* ── Benefits ───────────────────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-6 md:py-10">
        <div className="mb-6 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-snack-primary">
            Why food people get hooked
          </p>
          <h2 className="mt-3 font-heading text-3xl font-bold text-snack-text md:text-4xl">
            Not another star-average machine. Here&apos;s what&apos;s different.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {dict.features.map((feature) => (
            <article key={feature.title} className="card p-6">
              <span className="text-3xl" aria-hidden="true">{feature.icon}</span>
              <h3 className="mt-3 font-heading text-xl font-semibold text-snack-text">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-snack-muted">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="bg-snack-surface/50 py-6 md:py-10">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-snack-primary">How it works</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-snack-text md:text-4xl">
              From hungry to helpful in four steps
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {dict.steps.map((item) => (
              <article key={item.step} className="rounded-[1.5rem] border border-snack-border bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-snack-primary">{item.step}</p>
                <h3 className="mt-4 font-heading text-2xl font-semibold text-snack-text">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-snack-muted">{item.body}</p>
              </article>
            ))}
          </div>

          {/* Mid-page CTA */}
          <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-[1.5rem] border border-snack-border bg-snack-surface px-6 py-5 sm:flex-row">
            <p className="font-heading text-xl font-semibold text-snack-text">
              Sixty seconds. That&apos;s one review.
            </p>
            <Link href="/auth/register?ref=midpage" className="btn-primary text-sm">
              Post my first review
            </Link>
          </div>
        </div>
      </section>

      {/* ── Photo wall: activity is the social proof ───────────────────────── */}
      {wall.length >= 6 && (
        <section className="mx-auto max-w-6xl px-4 py-6 md:py-10">
          <div className="mb-6 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-snack-primary">
              Posted on SnackSpot
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-snack-text md:text-4xl">
              Real plates from real people
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
            {wall.map((photo) => (
              <Link
                key={photo.id}
                href={`/review/${photo.id}`}
                className="group relative aspect-square overflow-hidden rounded-2xl bg-snack-surface"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  alt={photo.dishName ?? 'Food photo shared on SnackSpot'}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                  loading="lazy"
                />
                <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
                  ★ {photo.rating.toFixed(1)}{photo.dishName ? ` ${photo.dishName}` : ''}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Community & honest numbers ─────────────────────────────────────── */}
      <section className="bg-snack-surface/50 py-6 md:py-10">
        <div className="mx-auto max-w-6xl px-4">
          <div className="card overflow-hidden p-0">
            <div className="grid gap-0 md:grid-cols-[0.95fr_1.05fr]">
              <div className="bg-gradient-to-br from-snack-primary to-snack-accent p-8 text-white">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">{dict.community.eyebrow}</p>
                <h2 className="mt-3 font-heading text-3xl font-bold">
                  {dict.community.title}
                </h2>
                <p className="mt-4 text-sm leading-6 text-white/85">
                  {dict.community.body}
                </p>
                <p className="mt-4 text-sm font-semibold text-white/90">
                  {dict.community.tagline}
                </p>
              </div>
              <div className="p-8">
                {stats.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {stats.map((stat) => (
                      <div key={stat.label} className="rounded-2xl bg-snack-surface p-5">
                        <p className="font-heading text-3xl font-bold text-snack-text">{stat.value}</p>
                        <p className="mt-1 text-sm text-snack-muted">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-snack-surface p-5">
                    <p className="text-sm leading-6 text-snack-muted">
                      We&apos;re early, which means the gems you add now are the ones everyone else
                      discovers later. First spotters get the First Bite credit, forever.
                    </p>
                  </div>
                )}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link href="/auth/register?ref=community" className="btn-primary text-sm">
                    {dict.community.ctaAdd}
                  </Link>
                  <Link href="/nearby" className="btn-secondary text-sm">
                    {dict.community.ctaExplore}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section id="faq" className="mx-auto max-w-4xl px-4 py-6 md:py-10">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-snack-primary">FAQ</p>
          <h2 className="mt-3 font-heading text-3xl font-bold text-snack-text md:text-4xl">Fair questions</h2>
        </div>
        <div className="space-y-2">
          {dict.faqs.map((faq) => (
            <details key={faq.q} className="card group p-5">
              <summary className="cursor-pointer list-none font-heading text-base font-semibold text-snack-text">
                <span className="flex items-center justify-between gap-3">
                  {faq.q}
                  <span className="text-snack-muted transition group-open:rotate-45" aria-hidden="true">+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-snack-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Slot CTA ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-2 md:pb-20">
        <div className="rounded-[1.75rem] bg-gradient-to-r from-snack-primary to-snack-accent p-10 text-center text-white md:p-14">
          <h2 className="font-heading text-3xl font-bold md:text-5xl">Hungry? Good. Stay that way.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/85 md:text-base">
            Join the food lovers mapping the best small spots around, one photo at a time.
          </p>
          <Link
            href="/auth/register?ref=footer"
            className="mt-7 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-snack-primary shadow-lg transition hover:opacity-90"
          >
            Create my free account
          </Link>
          <p className="mt-3 text-xs text-white/70">Takes 30 seconds. Works on any phone.</p>
        </div>
      </section>
    </MarketingShell>
  )
}
