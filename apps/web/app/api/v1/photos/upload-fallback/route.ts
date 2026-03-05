import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { BUCKET, minioClient } from '@/lib/minio'
import { ok, err, requireAuth, serverError, isResponse } from '@/lib/api-helpers'

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
])

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const photoId = req.nextUrl.searchParams.get('photoId')
  if (!photoId) return err('photoId is required', 422)

  try {
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      select: { id: true, uploaderId: true, storageKey: true, moderationStatus: true },
    })

    if (!photo) return err('Photo not found', 404)
    if (photo.uploaderId !== auth.sub) return err('Forbidden', 403)
    if (photo.moderationStatus !== 'PENDING') return err('Photo already uploaded', 409)

    const contentTypeRaw = req.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
    if (!ALLOWED_MIMES.has(contentTypeRaw)) return err('File type not allowed', 415)

    const buffer = Buffer.from(await req.arrayBuffer())
    if (buffer.length === 0) return err('Empty upload body', 400)
    if (buffer.length > env.MAX_FILE_SIZE_BYTES) {
      return err(`File too large - max ${env.MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`, 413)
    }

    await minioClient.putObject(BUCKET, photo.storageKey, buffer, buffer.length, {
      'Content-Type': contentTypeRaw,
    })

    return ok({ photoId: photo.id, uploaded: true, via: 'fallback' })
  } catch (e) {
    return serverError('photos/upload-fallback', e)
  }
}
