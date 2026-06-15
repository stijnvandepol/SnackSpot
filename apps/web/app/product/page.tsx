import type { Metadata } from 'next'
import Link from 'next/link'
import { ReviewStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { photoVariantUrl } from '@/lib/photo-url'
import { safeJsonLd } from '@/lib/html'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'
import { MarketingShell } from '@/components/marketing-shell'

// Marketing page with live community data — re-rendered every 5 minutes.
export const revalidate = 300

export const metadata: Metadata = {
  title: { absolute: 'Discover Hidden Food Gems Near You | SnackSpot' },
  description:
    'SnackSpot is the free community app where your camera eats first: photo reviews of specific dishes at the small local spots big review sites overlook.',
  alternates: {
    canonical: '/product',
  },
  openGraph: {
    type: 'website',
    title: 'Your camera eats first | SnackSpot',
    description:
      'Snap your food, rate the dish, and put the little places that deserve it on the map.',
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Your camera eats first | SnackSpot',
    description:
      'Snap your food, rate the dish, and put the little places that deserve it on the map.',
    images: ['/twitter-image'],
  },
}

// ─── Copy (docs/product-vision/06-landing-cro.md) ────────────────────────────

const benefits = [
  {
    title: 'Know what to order before you sit down',
    body: 'Every review is about a dish, not just a place. See the exact plate, the half-star ratings for taste, value and portion size, then walk in and order like a regular.',
    icon: '🍜',
  },
  {
    title: 'Hidden gems, zero tourist traps',
    body: 'SnackSpot is built for the hole-in-the-wall bakery and the snackbar with the legendary kapsalon. The big chains already have enough reviews.',
    icon: '📍',
  },
  {
    title: 'Your food diary, but useful',
    body: 'Every photo you post builds your streak, your stamps and your taste profile. Six months from now, "where was that insane ramen place?" takes three seconds to answer.',
    icon: '🔥',
  },
  {
    title: 'Reviews that take 60 seconds, not 600',
    body: 'Snap up to five photos, slide the stars, tag it, done. No essay required, the photo does the talking.',
    icon: '📸',
  },
]

const steps = [
  {
    step: '01',
    title: 'Spot it',
    body: 'Open the feed or the nearby map and find a place that makes you go "wait, what\'s that?"',
  },
  {
    step: '02',
    title: 'Snap it',
    body: "Food arrives? Camera first, fork second. It's the SnackSpot way, your table will get used to it.",
  },
  {
    step: '03',
    title: 'Rate it',
    body: 'Slide the half-stars for taste, value and portion. Name the dish. Thirty seconds, tops.',
  },
  {
    step: '04',
    title: 'Share it',
    body: 'Your review goes live in the feed. Likes, comments and badges roll in, and someone nearby just found their new favorite spot because of you.',
  },
]

const faqs = [
  {
    q: 'What is SnackSpot?',
    a: 'SnackSpot is a free community app for discovering hidden food gems, the small local places big review sites overlook. Members share photo reviews of specific dishes with honest half-star ratings for taste, value, portion size and service.',
  },
  {
    q: 'Is SnackSpot free?',
    a: 'Completely. No subscription, no credit card, no catch. Create an account and start spotting.',
  },
  {
    q: 'Do I need to download an app?',
    a: 'No. SnackSpot runs in your browser and works like an app on your phone, you can add it to your home screen in two taps. No app store, no storage space sacrificed.',
  },
  {
    q: 'How is SnackSpot different from Google Maps or Tripadvisor reviews?',
    a: 'Three ways: we focus on small local spots instead of chains and tourist magnets; every review is photo-first and about a specific dish, not a vague place average; and ratings are split into taste, value, portion and service, so "4 stars" actually tells you something.',
  },
  {
    q: 'Can I find food spots near me?',
    a: "Yes, the nearby view shows community-reviewed places around your location, so you can see what's good within walking distance.",
  },
  {
    q: 'Do I have to write long reviews?',
    a: 'Nope. A review is photos plus ratings plus an optional note. Most take under a minute. The photo does the heavy lifting.',
  },
  {
    q: 'What are streaks, badges and the Food Passport?',
    a: 'Log a photo of any meal to build a daily streak, earn XP and levels, and collect passport stamps for dishes, cuisines and cities you review. No pressure, just bragging rights.',
  },
  {
    q: 'Can restaurant owners join?',
    a: "Owners can't review their own place (obviously), but we love it when they claim their spot's photos are accurate. A dedicated owner experience is on our roadmap.",
  },
  {
    q: 'Who sees my reviews?',
    a: "Reviews and profiles are public, that's the point: your find helps the next hungry person. Daily meal logs (bites) are only visible to people you mutually follow. You choose your username, and you control what you post.",
  },
]

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
  const { wall, placesCount, citiesCount, photosThisWeek } = await getCommunityData()

  // A number only goes on the page when it impresses without context.
  const stats = [
    placesCount >= 10 ? { value: placesCount, label: 'Hidden gems on the map' } : null,
    citiesCount >= 2 ? { value: citiesCount, label: 'Cities with at least one gem' } : null,
    photosThisWeek >= 25 ? { value: photosThisWeek, label: 'Photos shared this week' } : null,
  ].filter((s): s is { value: number; label: string } => s !== null)

  // Static FAQ copy serialized through the codebase's safeJsonLd sanitizer —
  // same pattern as the breadcrumb/review JSON-LD on other pages.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  const heroWall = wall.slice(0, 5)

  return (
    <MarketingShell>
      <BreadcrumbJsonLd items={[{ name: 'About SnackSpot', path: '/product' }]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-24">
        <div>
          <p className="mb-4 inline-flex rounded-full border border-snack-primary/20 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-snack-primary">
            📍 Hidden gems only, chains need not apply
          </p>
          <h1 className="max-w-3xl font-heading text-5xl font-bold leading-tight text-snack-text md:text-7xl">
            Your camera eats first.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-snack-muted md:text-lg">
            Snap your food, rate the dish, and put the little places that deserve it on the map.
            SnackSpot is where food lovers share the spots Google hasn&apos;t ruined yet.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/auth/register?ref=hero" className="btn-primary text-sm">
              Start spotting, it&apos;s free
            </Link>
            <Link href="/" className="btn-secondary text-sm">
              Peek at the feed first
            </Link>
          </div>
          <p className="mt-3 text-xs text-snack-muted">
            No app store, no credit card. Works right in your browser.
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
      <section id="features" className="mx-auto max-w-6xl px-4 py-8 md:py-14">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-snack-primary">
            Why food people get hooked
          </p>
          <h2 className="mt-3 font-heading text-3xl font-bold text-snack-text md:text-4xl">
            Not another star-average machine. Here&apos;s what&apos;s different.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {benefits.map((benefit) => (
            <article key={benefit.title} className="card p-6">
              <span className="text-3xl" aria-hidden="true">{benefit.icon}</span>
              <h3 className="mt-3 font-heading text-xl font-semibold text-snack-text">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-6 text-snack-muted">{benefit.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-8 md:py-14">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-snack-primary">How it works</p>
          <h2 className="mt-3 font-heading text-3xl font-bold text-snack-text md:text-4xl">
            From hungry to helpful in four steps
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {steps.map((item) => (
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
      </section>

      {/* ── Photo wall: activity is the social proof ───────────────────────── */}
      {wall.length >= 6 && (
        <section className="mx-auto max-w-6xl px-4 py-8 md:py-14">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-snack-primary">
              Posted on SnackSpot
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-snack-text md:text-4xl">
              Real plates from real people
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
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
      <section className="mx-auto max-w-6xl px-4 py-8 md:py-14">
        <div className="card overflow-hidden p-0">
          <div className="grid gap-0 md:grid-cols-[0.95fr_1.05fr]">
            <div className="bg-gradient-to-br from-snack-primary to-snack-accent p-8 text-white">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">Community</p>
              <h2 className="mt-3 font-heading text-3xl font-bold">
                This only works because of people like you
              </h2>
              <p className="mt-4 text-sm leading-6 text-white/85">
                Every gem on SnackSpot was found, photographed and rated by a real person, not an
                algorithm, not an ad budget. The little bánh mì counter gets discovered because
                someone took thirty seconds to share it. That someone could be you.
              </p>
              <p className="mt-4 text-sm font-semibold text-white/90">
                Small team, big appetite. Built in the Netherlands, hungry everywhere.
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
                  Add your first gem
                </Link>
                <Link href="/nearby" className="btn-secondary text-sm">
                  Explore nearby places
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section id="faq" className="mx-auto max-w-4xl px-4 py-8 md:py-14">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-snack-primary">FAQ</p>
          <h2 className="mt-3 font-heading text-3xl font-bold text-snack-text md:text-4xl">Fair questions</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((faq) => (
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
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-4 md:pb-24">
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
