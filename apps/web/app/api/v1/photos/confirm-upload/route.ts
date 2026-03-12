import { type NextRequest } from 'next/server'
import { ConfirmUploadSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { getObjectInfo } from '@/lib/minio'
import { getPhotoQueue } from '@/lib/queue'
import type { PhotoJob } from '@/lib/queue'
import { env } from '@/lib/env'
import { ok, err, parseBody, requireAuth, serverError, isResponse } from '@/lib/api-helpers'
import { ALLOWED_IMAGE_MIMES } from '@/lib/upload'
import { getObjectHeaderBytes } from '@/lib/minio'

// Magic byte signatures for the image types we accept.
// AVIF and HEIC use an ISOBMFF container whose header varies — we skip
// signature validation for those and rely on Sharp's decode step in the worker.
const MAGIC_SIGNATURES: Record<string, (buf: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF,
  'image/png':  (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47,
  'image/gif':  (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  // WebP: starts with RIFF????WEBP
  'image/webp': (b) =>
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
}

function matchesMagicBytes(mimeType: string, buf: Buffer): boolean {
  const check = MAGIC_SIGNATURES[mimeType]
  // No signature defined for this type (AVIF/HEIC) — allow through.
  if (!check) return true
  return buf.length >= 12 && check(buf)
}

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
    if (!contentType || !ALLOWED_IMAGE_MIMES.has(contentType)) {
      return err('File type not allowed', 415)
    }

    // Verify magic bytes so an attacker cannot upload an executable with a
    // spoofed Content-Type header via the presigned PUT URL.
    const headerBytes = await getObjectHeaderBytes(photo.storageKey, 12)
    if (!headerBytes || !matchesMagicBytes(contentType, headerBytes)) {
      return err('File contents do not match declared type', 415)
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
