import type { Metadata } from 'next'
import { FeedClient } from '@/components/feed-client'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'

const title = 'SnackSpot — Discover Local Food Spots'
const description =
  'Discover under-the-radar food spots near you. Browse reviews of local snack bars, cafés, and hidden gems shared by the community.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/' },
  openGraph: { title, description },
  twitter: { title, description },
}

export default function FeedPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <BreadcrumbJsonLd items={[]} />

      <div className="mb-6 space-y-1">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-snack-text">Latest Food Reviews</h1>
        <p className="text-sm text-snack-muted">Discover photo reviews of local food spots near you — scroll, like, and find your next meal.</p>
      </div>

      <FeedClient />
    </div>
  )
}
