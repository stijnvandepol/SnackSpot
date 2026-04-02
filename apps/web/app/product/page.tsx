import type { Metadata } from 'next'
import Link from 'next/link'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'
import { SnackSpotLogo } from '@/components/snack-spot-logo'

export const metadata: Metadata = {
  title: 'SnackSpot – Discover Hidden Food Gems Near You',
  description:
    'SnackSpot is a community app for discovering under-the-radar food spots, posting photo reviews, and sharing smaller local places worth knowing.',
  alternates: {
    canonical: '/product',
  },
  openGraph: {
    type: 'website',
    title: 'SnackSpot – Discover Hidden Food Gems Near You',
    description:
      'SnackSpot is a community app for discovering under-the-radar food spots, posting photo reviews, and sharing smaller local places worth knowing.',
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SnackSpot – Discover Hidden Food Gems Near You',
    description:
      'SnackSpot is a community app for discovering under-the-radar food spots, posting photo reviews, and sharing smaller local places worth knowing.',
    images: ['/twitter-image'],
  },
}

const pillars = [
  {
    title: 'Find spots locals actually love',
    body: 'Skip generic top lists and discover smaller places with personality through a feed made by people nearby.',
  },
  {
    title: 'Know what to order before you go',
    body: 'See real photos, dish tips, and clear ratings so you can choose confidently instead of guessing from random stars.',
  },
  {
    title: 'Share your own hidden gems',
    body: 'Post your best finds, help others eat better, and build your own taste profile one review at a time.',
  },
]

const features = [
  'Photo-first feed full of real local recommendations',
  'Nearby discovery to instantly find great places around you',
  'Structured reviews with dish notes and detailed ratings',
  'Fast photo uploads so sharing takes seconds, not minutes',
  'Profiles, badges, and streaks that reward consistent contributors',
  'Comments and likes that help good spots spread quickly',
]

const flow = [
  {
    step: '01',
    title: 'Discover',
    body: 'Open the feed, search, or explore nearby to find food spots that are still under the radar.',
  },
  {
    step: '02',
    title: 'Choose',
    body: 'Compare photos, dishes, and ratings to decide exactly where to go and what to try first.',
  },
  {
    step: '03',
    title: 'Share',
    body: 'Drop your own review after eating, so the next person can discover something worth the detour.',
  },
]

export default function ProductPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.14),_transparent_32%),linear-gradient(180deg,#fff7ed_0%,#ffffff_28%,#ffffff_100%)] text-snack-text">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="shrink-0">
            <SnackSpotLogo className="text-xl" />
          </Link>
          <nav aria-label="Product page navigation" className="hidden items-center gap-5 text-sm text-snack-muted md:flex">
            <a href="#problem" className="hover:text-snack-text">Problem</a>
            <a href="#features" className="hover:text-snack-text">Features</a>
            <a href="#why" className="hover:text-snack-text">Why SnackSpot</a>
            <Link href="/guides" className="hover:text-snack-text">Guides</Link>
            <Link href="/releases" className="hover:text-snack-text">Release Notes</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/auth/login" className="btn-ghost text-sm">Log in</Link>
            <Link href="/auth/register" className="btn-primary text-sm">Create account</Link>
          </div>
        </div>
      </header>

      <BreadcrumbJsonLd items={[{ name: 'About SnackSpot', path: '/product' }]} />

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.2fr_0.8fr] md:items-center md:py-24">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-snack-primary/20 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-snack-primary">
              Made for people who love finding good food first
            </p>
            <h1 className="max-w-3xl font-heading text-4xl font-bold leading-tight text-snack-text md:text-6xl">
              Find your next hidden food gem in minutes.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-snack-muted md:text-lg">
              SnackSpot helps you discover lesser-known local places, see what is actually worth ordering, and share your best finds with people who care about good food.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/auth/register" className="btn-primary text-sm">Start with an account</Link>
              <Link href="/" className="btn-secondary text-sm">Open the app feed</Link>
              <Link href="/guides" className="btn-secondary text-sm">Read guides</Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-snack-border bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">Core value</p>
                <p className="mt-2 text-sm font-semibold text-snack-text">Better food choices through real photos, dish tips, and honest ratings</p>
              </div>
              <div className="rounded-2xl border border-snack-border bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">Audience</p>
                <p className="mt-2 text-sm font-semibold text-snack-text">Curious locals, food explorers, weekend wanderers, and everyday snack hunters</p>
              </div>
              <div className="rounded-2xl border border-snack-border bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">Outcome</p>
                <p className="mt-2 text-sm font-semibold text-snack-text">More memorable meals and fewer disappointing picks</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.75rem] border border-snack-border bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between">
                <SnackSpotLogo className="text-xl" />
                <span className="rounded-full bg-snack-surface px-3 py-1 text-xs font-medium text-snack-muted">Community feed</span>
              </div>
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-snack-surface p-4">
                  <p className="text-sm font-semibold text-snack-text">Photo reviews with context</p>
                  <p className="mt-1 text-sm text-snack-muted">Dish name, place, city, tags, likes, comments, and multiple rating dimensions for spots people do not already know.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-snack-border p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-snack-muted">Discovery</p>
                    <p className="mt-2 text-sm font-semibold text-snack-text">Search, nearby spots, featured places, and hidden-gem tags</p>
                  </div>
                  <div className="rounded-2xl border border-snack-border p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-snack-muted">Community</p>
                    <p className="mt-2 text-sm font-semibold text-snack-text">Profiles, reactions, comments, and trusted recommendations from real people</p>
                  </div>
                </div>
                <div className="rounded-2xl bg-gradient-to-r from-snack-primary to-snack-accent p-4 text-white">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/80">Product focus</p>
                  <p className="mt-2 text-sm font-semibold">The experience is built around finding better spots, choosing smarter, and sharing the places you would recommend to friends.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="problem" className="mx-auto max-w-6xl px-4 py-8 md:py-14">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-snack-primary">Problem</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-snack-text md:text-4xl">
              Great local food is hard to find when most apps push the same popular places instead of personal, in-the-moment recommendations.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {pillars.map((pillar) => (
              <article key={pillar.title} className="card p-6">
                <h3 className="font-heading text-xl font-semibold text-snack-text">{pillar.title}</h3>
                <p className="mt-3 text-sm leading-6 text-snack-muted">{pillar.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-8 md:py-14">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-snack-primary">Solution</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-snack-text md:text-4xl">
              SnackSpot gives you a faster way to find food you will actually enjoy, backed by real experiences from people near you.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {features.map((feature) => (
              <div key={feature} className="card flex gap-4 p-5">
                <div className="mt-1 h-3 w-3 rounded-full bg-snack-primary" aria-hidden="true" />
                <p className="text-sm leading-6 text-snack-text">{feature}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 md:py-14">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-snack-primary">How it works</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-snack-text md:text-4xl">
              A simple flow: discover a spot, decide what to try, and pass the recommendation on.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {flow.map((item) => (
              <article key={item.step} className="rounded-[1.5rem] border border-snack-border bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-snack-primary">{item.step}</p>
                <h3 className="mt-4 font-heading text-2xl font-semibold text-snack-text">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-snack-muted">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="why" className="mx-auto max-w-6xl px-4 py-8 md:py-14">
          <div className="card overflow-hidden p-0">
            <div className="grid gap-0 md:grid-cols-[0.95fr_1.05fr]">
              <div className="bg-gradient-to-br from-snack-primary to-snack-accent p-8 text-white">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">Why this product</p>
                <h2 className="mt-3 font-heading text-3xl font-bold">Built for real food discoveries, not generic top-10 lists.</h2>
                <p className="mt-4 text-sm leading-6 text-white/85">
                  The value comes from helping great local places get discovered through authentic photos, useful dish context, and recommendations you can trust.
                </p>
              </div>
              <div className="p-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-snack-surface p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-snack-muted">Primary users</p>
                    <p className="mt-2 text-sm font-semibold text-snack-text">Locals, explorers, and reviewers chasing hidden gems</p>
                  </div>
                  <div className="rounded-2xl bg-snack-surface p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-snack-muted">Core use cases</p>
                    <p className="mt-2 text-sm font-semibold text-snack-text">Discover new spots, pick better dishes, save favorites, and share reviews</p>
                  </div>
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link href="/auth/register" className="btn-primary text-sm">Create an account</Link>
                  <Link href="/nearby" className="btn-secondary text-sm">Explore nearby places</Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-4 pb-10 pt-4 text-center">
        <p className="text-sm font-medium text-snack-muted">
          &copy; {new Date().getFullYear()} SnackSpot
        </p>
      </footer>
    </div>
  )
}
