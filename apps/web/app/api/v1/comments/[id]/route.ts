import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { noContent, err, requireAuth, isResponse, serverError } from '@/lib/api-helpers'
import { recalculateUserBadges } from '@/lib/badge-service'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  try {
    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { id: true, userId: true, review: { select: { userId: true } } },
    })
    if (!comment) return err('Comment not found', 404)

    const isOwner = comment.userId === auth.sub
    const isMod = auth.role === 'MODERATOR' || auth.role === 'ADMIN'
    if (!isOwner && !isMod) return err('Forbidden', 403)

    await prisma.comment.delete({ where: { id } })
    await recalculateUserBadges(comment.review.userId, { criteriaTypes: ['COMMENTS_RECEIVED_COUNT'] })
    return noContent()
  } catch (e) {
    return serverError('comments/[id] DELETE', e)
  }
}
