import { type NextRequest } from 'next/server'
import sharp from 'sharp'
import { BUCKET, minioClient } from '@/lib/minio'
import { AVATAR_VARIANT_SIZE, avatarVariantKey } from '@/lib/avatar'

export const runtime = 'nodejs'

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

async function streamToBuffer(stream: import('stream').Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
  }
  return Buffer.concat(chunks)
}

export async function GET(req: NextRequest) {
  const rawKey = req.nextUrl.searchParams.get('key')
  if (!rawKey) return new Response('Missing key', { status: 400 })

  const key = normalizeAvatarKey(rawKey)
  if (!key) return new Response('Invalid key', { status: 400 })

  try {
    const variantKey = avatarVariantKey(key)
    const variantStat = await minioClient.statObject(BUCKET, variantKey).catch(() => null)
    if (variantStat) {
      const variantStream = await minioClient.getObject(BUCKET, variantKey).catch(() => null)
      if (variantStream) {
        const variant = await streamToBuffer(variantStream)
        return new Response(new Uint8Array(variant), {
          headers: {
            'Content-Type': 'image/webp',
            'Content-Length': String(variant.byteLength),
            'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
          },
        })
      }
    }

    const stat = await minioClient.statObject(BUCKET, key).catch(() => null)
    if (!stat) return new Response('Not found', { status: 404 })

    const objectStream = await minioClient.getObject(BUCKET, key).catch(() => null)
    if (!objectStream) return new Response('Not found', { status: 404 })

    const original = await streamToBuffer(objectStream)

    const resized = await sharp(original)
      .resize(AVATAR_VARIANT_SIZE, AVATAR_VARIANT_SIZE, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80 })
      .toBuffer()

    return new Response(new Uint8Array(resized), {
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
