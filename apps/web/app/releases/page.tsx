import type { Metadata } from 'next'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'
import { MarketingShell } from '@/components/marketing-shell'

export const metadata: Metadata = {
  title: { absolute: 'Release Notes | SnackSpot' },
  description: "What's new in SnackSpot — features, improvements, and fixes.",
  alternates: { canonical: '/releases' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    title: 'Release Notes | SnackSpot',
    description: "What's new in SnackSpot — features, improvements, and fixes.",
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Release Notes | SnackSpot',
    description: "What's new in SnackSpot — features, improvements, and fixes.",
    images: ['/twitter-image'],
  },
}

type ChangeType = 'new' | 'improved' | 'fixed' | 'removed'

interface Change {
  type: ChangeType
  text: string
}

interface Release {
  version: string
  date: string
  summary: string
  changes: Change[]
}

const CHANGE_TYPE_CONFIG: Record<ChangeType, { label: string; className: string }> = {
  new:      { label: 'New',      className: 'bg-green-100 text-green-700' },
  improved: { label: 'Improved', className: 'bg-blue-100 text-blue-700' },
  fixed:    { label: 'Fixed',    className: 'bg-amber-100 text-amber-700' },
  removed:  { label: 'Removed',  className: 'bg-red-100 text-red-700' },
}

// Add new releases at the top of this array.
const releases: Release[] = [
  {
    version: '1.4.0',
    date: '2 April 2026',
    summary: 'Email notifications, feed standardization, and bug fixes.',
    changes: [
      { type: 'new',      text: 'Email notifications for likes, comments, mentions, and badge awards.' },
      { type: 'new',      text: 'Feed post layout standardized — every review card now shows the dish name, place, rating, tags, and like count in a consistent format.' },
      { type: 'new',      text: 'Dynamic Open Graph images for places, reviews, and user profiles.' },
      { type: 'new',      text: 'Release notes page added to track changes.' },
      { type: 'improved', text: 'Like button redesigned with a filled heart animation, matching familiar social app patterns.' },
      { type: 'improved', text: 'Likes now correctly reflect your previous activity when reopening the app.' },
      { type: 'improved', text: 'Stats and achievements page redesigned with inline descriptions and a unified earned/in-progress list.' },
      { type: 'improved', text: 'Place page titles now include the city name for better search results.' },
      { type: 'fixed',    text: 'Like state was lost after reopening the app — the feed now waits for your session to restore before loading.' },
      { type: 'fixed',    text: 'Several hardcoded colors replaced with dark mode-aware tokens across add-review, search, notifications, and profile pages.' },
      { type: 'removed',  text: 'Push notification settings removed — push was never fully functional.' },
    ],
  },
  {
    version: '1.3.0',
    date: '14 March 2026',
    summary: 'Dark mode support and verification badges.',
    changes: [
      { type: 'new',      text: 'Dark mode added across the entire app — toggle it in your profile settings.' },
      { type: 'new',      text: 'Verification badge shown on profiles of trusted contributors.' },
      { type: 'improved', text: 'Admin panel: review title and body can now be edited directly from the dashboard.' },
      { type: 'fixed',    text: 'Hardcoded colors replaced with design tokens throughout the app for full dark mode compatibility.' },
    ],
  },
  {
    version: '1.2.0',
    date: '1 March 2026',
    summary: 'Badge system, notifications, and performance improvements.',
    changes: [
      { type: 'new',      text: 'Badge system with Bronze, Silver, and Gold tiers based on posts, streaks, likes received, and locations visited.' },
      { type: 'new',      text: 'In-app notification bell for likes, comments, mentions, and badge awards.' },
      { type: 'improved', text: 'Photo upload flow improved with fallback support and better error messages.' },
      { type: 'improved', text: 'Feed pagination performance improved.' },
    ],
  },
]

export default function ReleasesPage() {
  return (
    <MarketingShell>
      <BreadcrumbJsonLd items={[{ name: 'Release Notes', path: '/releases' }]} />

      <div className="mx-auto max-w-3xl px-4 py-16 md:py-24">
        <div className="mb-12">
          <p className="mb-4 inline-flex rounded-full border border-snack-primary/20 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-snack-primary">
            Changelog
          </p>
          <h1 className="font-heading text-4xl font-bold leading-tight text-snack-text md:text-5xl">
            Release Notes
          </h1>
          <p className="mt-4 text-base leading-7 text-snack-muted">
            What we've shipped — new features, improvements, and fixes.
          </p>
        </div>

        <ol className="relative border-l border-snack-border">
          {releases.map((release) => (
            <li key={release.version} className="mb-12 ml-6">
              <span
                className="absolute -left-2.5 mt-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-snack-primary shadow-sm"
                aria-hidden="true"
              />

              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="rounded-full bg-snack-primary px-3 py-0.5 text-xs font-bold text-white">
                  v{release.version}
                </span>
                <time className="text-sm text-snack-muted">{release.date}</time>
              </div>

              <p className="mb-4 text-base font-semibold text-snack-text">{release.summary}</p>

              <ul className="space-y-2">
                {release.changes.map((change, i) => {
                  const config = CHANGE_TYPE_CONFIG[change.type]
                  return (
                    <li key={i} className="flex items-start gap-3">
                      <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
                        {config.label}
                      </span>
                      <span className="text-sm leading-5 text-snack-text">{change.text}</span>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </MarketingShell>
  )
}
