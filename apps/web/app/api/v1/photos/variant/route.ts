import { type NextRequest } from 'next/server'
import { Readable } from 'node:stream'
import { BUCKET, minioClient } from '@/lib/minio'

export const runtime = 'nodejs'

const ONE_YEAR_SECONDS = 31536000

function normalizeVariantKey(rawKey: string): string | null {
  let key: string
  try {
    key = decodeURIComponent(rawKey).trim().replaceAll('\\', '/')
  } catch {
    return null
  }

  while (key.startsWith('/')) key = key.slice(1)

  if (!key.startsWith('variants/')) return null
  if (key.includes('..')) return null
  if (key.length === 0 || key.length > 512) return null

  return key
}

function extractContentType(meta: Record<string, string | string[] | undefined>): string {
  const value = meta['content-type'] ?? meta['Content-Type'] ?? 'application/octet-stream'
  return Array.isArray(value) ? value[0] ?? 'application/octet-stream' : value
}

export async function GET(req: NextRequest) {
  const rawKey = req.nextUrl.searchParams.get('key')
  if (!rawKey) return new Response('Missing key', { status: 400 })

  const key = normalizeVariantKey(rawKey)
  if (!key) return new Response('Invalid key', { status: 400 })

  try {
    const stat = await minioClient.statObject(BUCKET, key).catch(() => null)
    if (!stat) return new Response('Not found', { status: 404 })

    const objectStream = await minioClient.getObject(BUCKET, key).catch(() => null)
    if (!objectStream) return new Response('Not found', { status: 404 })

    return new Response(Readable.toWeb(objectStream) as ReadableStream, {
      headers: {
        'Content-Type': extractContentType(stat.metaData ?? {}),
        'Content-Length': String(stat.size),
        'Cache-Control': `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
      },
    })
  } catch {
    return new Response('Internal server error', { status: 500 })
  }
}

