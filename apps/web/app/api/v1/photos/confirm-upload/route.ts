import { type NextRequest } from 'next/server'
import { ConfirmUploadSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { objectExists } from '@/lib/minio'
import { getPhotoQueue } from '@/lib/queue'
import type { PhotoJob } from '@/lib/queue'
import { ok, err, parseBody, requireAuth, serverError, isResponse } from '@/lib/api-helpers'

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const body = await parseBody(req, ConfirmUploadSchema)
  if (isResponse(body)) return body

  try {
    const photo = await prisma.photo.findUnique({
      where: { id: body.photoId },
      select: { id: true, storageKey: true, uploaderId: true, moderationStatus: true },
    })

    if (!photo) return err('Photo not found', 404)
    if (photo.uploaderId !== auth.sub) return err('Forbidden', 403)
    if (photo.moderationStatus !== 'PENDING') return err('Photo already confirmed', 409)

    // Verify the object was actually uploaded to MinIO
    const exists = await objectExists(photo.storageKey)
    if (!exists) return err('Upload not found – please upload the file first', 400)

    // Enqueue processing job
    const queue = getPhotoQueue()
    const job: PhotoJob = {
      photoId: photo.id,
      storageKey: photo.storageKey,
      uploaderId: auth.sub,
    }
    await queue.add('process-photo', job)

    return ok({ photoId: photo.id, status: 'processing' })
  } catch (e) {
    return serverError('photos/confirm-upload', e)
  }
}
