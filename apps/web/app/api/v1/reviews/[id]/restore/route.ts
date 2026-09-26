import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, err, requireAuth, requireSameOrigin, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'
import { ReviewStatus } from '@prisma/client'
import { recalculateUserBadges } from '@/lib/badge-service'
import { canRestoreReview } from '@/lib/privacy'

// POST /api/v1/reviews/[id]/restore — undo a self-deletion within the 30-day
// restore window. Moderator-deleted reviews are not restorable by the owner.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sameOrigin = requireSameOrigin(req)
  if (sameOrigin) return sameOrigin

  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const rl = await rateLimitUser(auth.sub, 'restore_review', 10, 3600)
  if (!rl.allowed) return err('Je gaat even te snel. Probeer het zo opnieuw.', 429)

  const { id } = await params

  try {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { userId: true, status: true, deletedAt: true, deletedById: true },
    })
    if (!review || review.status !== ReviewStatus.DELETED) return err('Review niet gevonden.', 404)

    const verdict = canRestoreReview(review, auth.sub)
    if (!verdict.allowed) {
      switch (verdict.reason) {
        case 'NOT_OWNER':
          // 404, not 403: don't leak the existence of someone else's deleted review
          return err('Review niet gevonden.', 404)
        case 'MOD_DELETED':
          return err('Deze review is door een moderator verwijderd en kan niet worden teruggezet.', 403)
        case 'WINDOW_EXPIRED':
          return err('De termijn om deze review terug te zetten is verlopen.', 410)
      }
    }

    await prisma.review.update({
      where: { id },
      data: { status: ReviewStatus.PUBLISHED, deletedAt: null, deletedById: null },
    })
    await recalculateUserBadges(review.userId)

    return ok({ message: 'Review teruggezet.' })
  } catch (e) {
    return serverError('reviews/[id]/restore', e)
  }
}
