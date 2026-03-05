import { type NextRequest } from 'next/server'
import { ConfirmUploadSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { getObjectInfo } from '@/lib/minio'
import { getPhotoQueue } from '@/lib/queue'
import type { PhotoJob } from '@/lib/queue'
import { env } from '@/lib/env'
import { ok, err, parseBody, requireAuth, serverError, isResponse } from '@/lib/api-helpers'

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
])

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const body = await parseBody(req, ConfirmUploadSchema)
  if (isResponse(body)) return body

  try {
    const photo = await prisma.photo.findUnique({
      where: { id: body.photoId },
      select: { id: true, storageKey: true, uploaderId: true, moderationStatus: true, metadata: true },
    })

    if (!photo) return err('Photo not found', 404)
    if (photo.uploaderId !== auth.sub) return err('Forbidden', 403)
    if (photo.moderationStatus !== 'PENDING') return err('Photo already confirmed', 409)

    // Verify object existence and enforce server-side constraints.
    const objectInfo = await getObjectInfo(photo.storageKey)
    if (!objectInfo) return err('Upload not found - please upload the file first', 400)
    if (objectInfo.size > env.MAX_FILE_SIZE_BYTES) {
      return err(`File too large - max ${env.MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`, 413)
    }
    const metadataContentType =
      photo.metadata &&
      typeof photo.metadata === 'object' &&
      !Array.isArray(photo.metadata) &&
      typeof (photo.metadata as Record<string, unknown>).contentType === 'string'
        ? String((photo.metadata as Record<string, unknown>).contentType)
        : null

    const rawContentType = objectInfo.contentType ?? metadataContentType
    const contentType = rawContentType?.split(';')[0]?.trim().toLowerCase() ?? null
    if (!contentType || !ALLOWED_MIMES.has(contentType)) {
      return err('File type not allowed', 415)
    }

    // Atomic transition prevents duplicate queueing.
    const transitioned = await prisma.photo.updateMany({
      where: { id: photo.id, uploaderId: auth.sub, moderationStatus: 'PENDING' },
      data: { moderationStatus: 'PROCESSING' },
    })
    if (transitioned.count === 0) return err('Photo already confirmed', 409)

    // Enqueue processing job.
    const queue = getPhotoQueue()
    const job: PhotoJob = {
      photoId: photo.id,
      storageKey: photo.storageKey,
      uploaderId: auth.sub,
    }
    try {
      await queue.add('process-photo', job, { jobId: photo.id })
    } catch (queueErr) {
      await prisma.photo.update({
        where: { id: photo.id },
        data: { moderationStatus: 'PENDING' },
      }).catch(() => undefined)
      throw queueErr
    }

    return ok({ photoId: photo.id, status: 'processing' })
  } catch (e) {
    return serverError('photos/confirm-upload', e)
  }
}
