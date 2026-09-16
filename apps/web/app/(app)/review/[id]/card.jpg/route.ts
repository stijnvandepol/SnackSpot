import { renderReviewShareCard } from '@/lib/share-card'
import { logger } from '@/lib/logger'

// Rendering needs sharp and a MinIO read; neither runs on the edge runtime.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /review/[id]/card.jpg — the og:image for a review.
 *
 * Cached for a day at the edge and an hour in the browser: the card changes only when the
 * review is edited, and messaging apps snapshot the preview at share time anyway. The
 * `.jpg` extension is what makes Cloudflare cache it without a dedicated rule — the photo
 * variants under /api/v1/photos/ have no extension and still need one (see
 * infra/SEO_CRAWL_HEALTH.md §1).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const jpeg = await renderReviewShareCard(id)
    if (!jpeg) return new Response('Not found', { status: 404 })

    return new Response(new Uint8Array(jpeg), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(jpeg.byteLength),
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch (error) {
    logger.error({ err: error, reviewId: id }, 'Failed to render review share card')
    return new Response('Internal server error', { status: 500 })
  }
}
