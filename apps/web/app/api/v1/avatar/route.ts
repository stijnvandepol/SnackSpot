import { type NextRequest } from 'next/server'
import sharp from 'sharp'
import { BUCKET, minioClient } from '@/lib/minio'

export const runtime = 'nodejs'

// Avatars are displayed at 49–62 px; serve at 2× for HiDPI screens.
const AVATAR_SIZE = 128
// Cache for 7 days — avatars change infrequently.
const CACHE_SECONDS = 7 * 24 * 60 * 60

function normalizeAvatarKey(rawKey: string): string | null {
  let key: string
  try {
    key = decodeURIComponent(rawKey).trim().replaceAll('\\\\', '/')
  } catch {
    return null
  }

  while (key.startsWith('/')) key = key.slice(1)

  if (!key.startsWith('avatars/')) return null
  if (key.includes('..')) return null
  if (key.length === 0 || key.length > 512) return null

  return key
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer))
  }
  return Buffer.concat(chunks)
}

export async function GET(req: NextRequest) {
  const rawKey = req.nextUrl.searchParams.get('key')
  if (!rawKey) return new Response('Missing key', { status: 400 })

  const key = normalizeAvatarKey(rawKey)
  if (!key) return new Response('Invalid key', { status: 400 })

  try {
    const stat = await minioClient.statObject(BUCKET, key).catch(() => null)
    if (!stat) return new Response('Not found', { status: 404 })

    const objectStream = await minioClient.getObject(BUCKET, key).catch(() => null)
    if (!objectStream) return new Response('Not found', { status: 404 })

    const original = await streamToBuffer(objectStream)

    const resized = await sharp(original)
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80 })
      .toBuffer()

    return new Response(resized, {
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(resized.byteLength),
        'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
      },
    })
  } catch {
    return new Response('Internal server error', { status: 500 })
  }
}
