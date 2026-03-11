import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Product',
  description:
    'SnackSpot is a mobile-first community app for discovering under-the-radar food spots, posting photo reviews, and sharing smaller local places worth knowing.',
  alternates: {
    canonical: '/product',
  },
}

const pillars = [
  {
    title: 'Find places worth the detour',
    body: 'Browse a live feed, search by place, or open nearby discovery to uncover smaller local spots that rarely show up in mainstream food guides.',
  },
  {
    title: 'Review overlooked local gems',
    body: 'Every post combines photos, place data, dish names, and category ratings so good lesser-known places get useful context instead of one-line praise.',
  },
  {
    title: 'Run the platform safely',
    body: 'Moderation tools, reports, comment filtering, badges, notifications, and a separate admin app support ongoing community management.',
  },
]

const features = [
  'Photo-first feed with likes, comments, mentions, and user profiles',
  'Nearby discovery to find local spots around you',
  'Structured reviews with half-star ratings and discovery tags',
  'Fast photo uploads for the feed and place pages',
  'Notifications, badge progress, profile stats, and streak tracking',
  'Separate admin panel for reports, reviews, users, places, and flagged comments',
]

const flow = [
  {
    step: '01',
    title: 'Discover',
    body: 'Users open the feed, search for a place, or scan a nearby list to find smaller spots worth trying.',
  },
  {
    step: '02',
    title: 'Review',
    body: 'They add a place, rate multiple aspects, upload photos, and publish a post tied to a real local location.',
  },
  {
    step: '03',
    title: 'Grow the community',
    body: 'Other users engage through likes, comments, mentions, notifications, badges, and reporting flows that keep recommendations useful.',
  },
]

const securityItems = [
  'Secure account sessions, role-based moderation, and protected admin access',
  'Controlled uploads, private originals, and public image variants for reviews',
  'Minimal cookie usage focused on login continuity rather than tracking',
  'Reporting and moderation flows to keep community content useful and trustworthy',
]

function BrandMark() {
  return (
    <span className="font-heading text-xl font-bold leading-none">
      <span className="text-snack-primary">Snack</span>
      <span className="inline-flex items-center text-snack-accent">
        Sp
        <span className="inline-flex h-[0.95em] w-[0.75em] items-center justify-center align-middle">
          <svg viewBox="0 0 16 20" fill="none" className="h-[0.95em] w-[0.75em]" aria-hidden="true">
            <path d="M8 19c2.6-3.5 6-7.5 6-11a6 6 0 1 0-12 0c0 3.5 3.4 7.5 6 11Z" fill="currentColor" />
            <circle cx="8" cy="8" r="2.25" fill="white" />
          </svg>
        </span>
        t
      </span>
    </span>
  )
}

export default function ProductPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.14),_transparent_32%),linear-gradient(180deg,#fff7ed_0%,#ffffff_28%,#ffffff_100%)] text-snack-text">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/feed" className="shrink-0">
            <BrandMark />
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-snack-muted md:flex">
            <a href="#problem" className="hover:text-snack-text">Problem</a>
            <a href="#features" className="hover:text-snack-text">Features</a>
            <a href="#security" className="hover:text-snack-text">Security</a>
            <a href="#why" className="hover:text-snack-text">Why SnackSpot</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/auth/login" className="btn-ghost text-sm">Log in</Link>
            <Link href="/auth/register" className="btn-primary text-sm">Create account</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.2fr_0.8fr] md:items-center md:py-24">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-snack-primary/20 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-snack-primary">
              Mobile-first hidden gem review app
            </p>
            <h1 className="max-w-3xl font-heading text-4xl font-bold leading-tight text-snack-text md:text-6xl">
              A social product for finding and reviewing the local spots most people still miss.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-snack-muted md:text-lg">
              SnackSpot combines a community feed, place discovery, photo uploads, and moderation tooling into one focused product for under-the-radar food spots, hidden gems, and smaller places worth sharing.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/auth/register" className="btn-primary text-sm">Start with an account</Link>
              <Link href="/feed" className="btn-secondary text-sm">Open the app feed</Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-snack-border bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">Core value</p>
                <p className="mt-2 text-sm font-semibold text-snack-text">Real hidden gems, real dishes, real community signals</p>
              </div>
              <div className="rounded-2xl border border-snack-border bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">Audience</p>
                <p className="mt-2 text-sm font-semibold text-snack-text">Curious locals, spot hunters, reviewers, moderators, admins</p>
              </div>
              <div className="rounded-2xl border border-snack-border bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">Deployment</p>
                <p className="mt-2 text-sm font-semibold text-snack-text">Built for a clear flow from discovery to posting to community moderation</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.75rem] border border-snack-border bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between">
                <BrandMark />
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
                    <p className="mt-2 text-sm font-semibold text-snack-text">Search, nearby discovery, featured places, tagged hidden gems</p>
                  </div>
                  <div className="rounded-2xl border border-snack-border p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-snack-muted">Operations</p>
                    <p className="mt-2 text-sm font-semibold text-snack-text">Reports, moderation tools, flagged comments, and user management</p>
                  </div>
                </div>
                <div className="rounded-2xl bg-gradient-to-r from-snack-primary to-snack-accent p-4 text-white">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/80">Product focus</p>
                  <p className="mt-2 text-sm font-semibold">The experience is built around surfacing overlooked places, posting useful reviews, and keeping the community trustworthy.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="problem" className="mx-auto max-w-6xl px-4 py-8 md:py-14">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-snack-primary">Problem</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-snack-text md:text-4xl">
              Smaller local food spots are easy to miss when discovery is dominated by mainstream listings, generic maps, and broad review sites.
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
              SnackSpot gives overlooked places a dedicated review flow built around discovery, context, and trusted community signals.
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
              The product flow is built around discovering hidden spots, documenting why they matter, and passing them on.
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

        <section id="security" className="mx-auto max-w-6xl px-4 py-8 md:py-14">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-[1.75rem] bg-snack-text p-8 text-white">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">Security and privacy</p>
              <h2 className="mt-3 font-heading text-3xl font-bold">The platform already enforces a practical security baseline.</h2>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                The current implementation focuses on safe account handling, controlled uploads, role-based moderation, and minimal cookie usage rather than broad marketing promises.
              </p>
            </div>
            <div className="grid gap-4">
              {securityItems.map((item) => (
                <div key={item} className="card p-5">
                  <p className="text-sm leading-6 text-snack-text">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="why" className="mx-auto max-w-6xl px-4 py-8 md:py-14">
          <div className="card overflow-hidden p-0">
            <div className="grid gap-0 md:grid-cols-[0.95fr_1.05fr]">
              <div className="bg-gradient-to-br from-snack-primary to-snack-accent p-8 text-white">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">Why this product</p>
                <h2 className="mt-3 font-heading text-3xl font-bold">Built for lesser-known food spots, not generic top-10 lists.</h2>
                <p className="mt-4 text-sm leading-6 text-white/85">
                  The value comes from giving small standout places better visibility through structured ratings, authentic photos, local discovery, and community moderation.
                </p>
              </div>
              <div className="p-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-snack-surface p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-snack-muted">Primary users</p>
                    <p className="mt-2 text-sm font-semibold text-snack-text">Locals, explorers, and reviewers chasing hidden gems</p>
                  </div>
                  <div className="rounded-2xl bg-snack-surface p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-snack-muted">Operational users</p>
                    <p className="mt-2 text-sm font-semibold text-snack-text">Moderators and admins maintaining content quality</p>
                  </div>
                  <div className="rounded-2xl bg-snack-surface p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-snack-muted">Core use cases</p>
                    <p className="mt-2 text-sm font-semibold text-snack-text">Discover overlooked spots, publish reviews, track engagement, resolve reports</p>
                  </div>
                  <div className="rounded-2xl bg-snack-surface p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-snack-muted">Product benefit</p>
                    <p className="mt-2 text-sm font-semibold text-snack-text">A focused way to surface small places with strong community context</p>
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
        <a
          href="https://stijnvandepol.nl"
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-snack-muted transition hover:text-snack-text"
        >
          Stijn van de Pol
        </a>
      </footer>
    </div>
  )
}
