import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { noContent, err, requireAuth, requireSameOrigin, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'
import { photoObjectKeys, removeObjectsBestEffort } from '@/lib/storage-cleanup'
import { logPrivacyAction } from '@/lib/privacy-audit'

// DELETE /api/v1/photos/[id] — erase an own photo (GDPR Art. 17). Hard-deletes
// the Photo row (cascades the review attachment and any bite built on it) and
// removes the original + variants from MinIO immediately.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sameOrigin = requireSameOrigin(req)
  if (sameOrigin) return sameOrigin

  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const rl = await rateLimitUser(auth.sub, 'delete_photo', 30, 3600)
  if (!rl.allowed) return err('Too many requests', 429)

  const { id } = await params

  try {
    const photo = await prisma.photo.findUnique({
      where: { id },
      select: {
        uploaderId: true,
        storageKey: true,
        variants: true,
        bite: { select: { id: true } },
      },
    })
    // 404, not 403, for photos of other users: don't leak that the id exists
    if (!photo || photo.uploaderId !== auth.sub) return err('Photo not found', 404)

    // Deleting the photo cascades the ReviewPhoto link and the bite built on
    // it; when a bite goes, its denormalised counter must follow (same
    // bookkeeping as the bites DELETE endpoint).
    await prisma.$transaction([
      prisma.photo.delete({ where: { id } }),
      ...(photo.bite
        ? [
            prisma.userStats.updateMany({
              where: { userId: auth.sub, bitesCount: { gt: 0 } },
              data: { bitesCount: { decrement: 1 } },
            }),
          ]
        : []),
    ])

    await removeObjectsBestEffort(photoObjectKeys(photo), 'photo-deletion')
    await logPrivacyAction(auth.sub, 'PHOTO_DELETED', { photoId: id })

    return noContent()
  } catch (e) {
    return serverError('photos/[id] DELETE', e)
  }
}
