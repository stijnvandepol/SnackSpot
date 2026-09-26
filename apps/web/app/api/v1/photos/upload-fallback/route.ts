import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { BUCKET, minioClient } from '@/lib/minio'
import { ok, err, requireAuth, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'
import { matchesMagicBytes } from '@/lib/magic-bytes'

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

  const rl = await rateLimitUser(auth.sub, 'photo_upload_fallback', 30, 3600)
  if (!rl.allowed) return err("Je uploadt te veel foto's achter elkaar. Probeer het zo opnieuw.", 429)

  const photoId = req.nextUrl.searchParams.get('photoId')
  if (!photoId) return err('Er ontbreekt een foto. Probeer het opnieuw.', 422)

  try {
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      select: { id: true, uploaderId: true, storageKey: true, moderationStatus: true },
    })

    if (!photo) return err('Foto niet gevonden.', 404)
    if (photo.uploaderId !== auth.sub) return err('Je hebt hier geen toegang toe.', 403)
    if (photo.moderationStatus !== 'PENDING') return err('Deze foto is al geüpload.', 409)

    const contentTypeRaw = req.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
    if (!ALLOWED_MIMES.has(contentTypeRaw)) return err('Dit bestandstype wordt niet ondersteund. Kies een foto.', 415)

    const buffer = Buffer.from(await req.arrayBuffer())
    if (buffer.length === 0) return err('Het bestand is leeg. Kies een andere foto.', 400)
    if (buffer.length > env.MAX_FILE_SIZE_BYTES) {
      return err(`Dit bestand is te groot. Maximaal ${env.MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`, 413)
    }

    if (!matchesMagicBytes(contentTypeRaw, buffer.subarray(0, 12))) {
      return err('Dit bestand is geen geldige foto. Kies een andere foto.', 415)
    }

    await minioClient.putObject(BUCKET, photo.storageKey, buffer, buffer.length, {
      'Content-Type': contentTypeRaw,
    })

    return ok({ photoId: photo.id, uploaded: true, via: 'fallback' })
  } catch (e) {
    return serverError('photos/upload-fallback', e)
  }
}
