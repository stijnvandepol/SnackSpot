import { randomUUID } from 'node:crypto'
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { BUCKET, minioClient } from '@/lib/minio'
import { ok, err, requireAuth, serverError, isResponse } from '@/lib/api-helpers'

export const runtime = 'nodejs'

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

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/heic-sequence': 'heic',
  'image/heif-sequence': 'heif',
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const contentType = req.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
  if (!ALLOWED_MIMES.has(contentType)) return err('File type not allowed', 415)

  try {
    const buffer = Buffer.from(await req.arrayBuffer())
    if (buffer.length === 0) return err('Empty upload body', 400)
    if (buffer.length > env.MAX_FILE_SIZE_BYTES) {
      return err(`File too large - max ${env.MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`, 413)
    }

    const ext = MIME_EXT[contentType] ?? 'bin'
    const storageKey = `avatars/${auth.sub}/${Date.now()}_${randomUUID()}.${ext}`

    await minioClient.putObject(BUCKET, storageKey, buffer, buffer.length, {
      'Content-Type': contentType,
    })

    const previous = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: { avatarKey: true },
    })

    await prisma.user.update({
      where: { id: auth.sub },
      data: { avatarKey: storageKey },
    })

    if (previous?.avatarKey && previous.avatarKey !== storageKey) {
      await minioClient.removeObject(BUCKET, previous.avatarKey).catch(() => undefined)
    }

    return ok({
      avatarKey: storageKey,
      avatarUrl: `/api/v1/avatar?key=${encodeURIComponent(storageKey)}`,
    })
  } catch (e) {
    return serverError('me/avatar POST', e)
  }
}
