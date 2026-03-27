import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { ReviewStatus } from '@prisma/client'
import { reviewListSelect, serializeReview } from '@/lib/review-helpers'
import { FeedClient } from '@/components/feed-client'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'

const INITIAL_FEED_LIMIT = 15

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

async function getInitialFeed() {
  try {
    const reviews = await prisma.review.findMany({
      where: { status: ReviewStatus.PUBLISHED },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: INITIAL_FEED_LIMIT + 1,
      select: reviewListSelect(),
    })

    const hasMore = reviews.length > INITIAL_FEED_LIMIT
    const items = hasMore ? reviews.slice(0, INITIAL_FEED_LIMIT) : reviews
    const nextCursor = hasMore
      ? encodeURIComponent(`${items.at(-1)!.createdAt.toISOString()}|${items.at(-1)!.id}`)
      : null

    return {
      reviews: items.map((r) => JSON.parse(JSON.stringify(serializeReview(r)))),
      nextCursor,
      hasMore,
    }
  } catch {
    return { reviews: [], nextCursor: null, hasMore: false }
  }
}

export default async function FeedPage() {
  const { reviews, nextCursor, hasMore } = await getInitialFeed()

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <BreadcrumbJsonLd items={[]} />

      <div className="mb-6 space-y-1">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-snack-text">Latest Food Reviews</h1>
        <p className="text-sm text-snack-muted">Discover photo reviews of local food spots near you — scroll, like, and find your next meal.</p>
      </div>

      <FeedClient
        initialReviews={reviews}
        initialCursor={nextCursor}
        initialHasMore={hasMore}
      />
    </div>
  )
}
