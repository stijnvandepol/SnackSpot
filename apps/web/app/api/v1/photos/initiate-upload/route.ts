import { type NextRequest } from 'next/server'
import { InitiateUploadSchema } from '@snackspot/shared'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { presignedPut, ensureBucket } from '@/lib/minio'
import { env } from '@/lib/env'
import { ok, err, parseBody, requireAuth, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'

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

  // Rate limit: 30 uploads per hour per user
  const rl = await rateLimitUser(auth.sub, 'photo_upload', 30, 3600)
  if (!rl.allowed) return err('Upload rate limit exceeded', 429)

  const body = await parseBody(req, InitiateUploadSchema)
  if (isResponse(body)) return body

  if (!ALLOWED_MIMES.has(body.contentType)) {
    return err('File type not allowed', 415)
  }
  if (body.size > env.MAX_FILE_SIZE_BYTES) {
    return err(`File too large – max ${env.MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`, 413)
  }

  try {
    await ensureBucket()

    const ext = body.contentType === 'image/png' ? 'png'
      : body.contentType === 'image/webp' ? 'webp'
      : body.contentType.startsWith('image/hei') ? 'heic'
      : 'jpg'

    const uuid = randomUUID()
    const storageKey = `originals/${auth.sub}/${uuid}.${ext}`

    // Create the photo record (pending state)
    const photo = await prisma.photo.create({
      data: {
        storageKey,
        uploaderId: auth.sub,
        metadata: {
          originalFilename: body.filename,
          contentType: body.contentType,
          size: body.size,
        },
      },
      select: { id: true, storageKey: true },
    })

    const uploadUrl = await presignedPut(storageKey)

    return ok({
      photoId: photo.id,
      storageKey: photo.storageKey,
      uploadUrl,
      expiresIn: 300,
    })
  } catch (e) {
    return serverError('photos/initiate-upload', e)
  }
}
