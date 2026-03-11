/**
 * SnackSpot image-processing worker.
 *
 * For each confirmed photo upload it:
 *   1. Downloads the original from MinIO
 *   2. Re-encodes to WebP (strips EXIF via sharp)
 *   3. Generates three size variants: thumb (256px), medium (1024px), large (2048px)
 *   4. Uploads variants to MinIO under variants/<uuid>/<size>.webp
 *   5. Updates the Photo record in Postgres with variant keys + metadata
 */

import { Worker, type Job } from 'bullmq'
import Redis from 'ioredis'
import * as Minio from 'minio'
import sharp from 'sharp'
import { PrismaClient, PhotoModerationStatus } from '@prisma/client'
import pino from 'pino'

// ─── Logger ──────────────────────────────────────────────────────────────────

const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
})

// ─── Env validation (minimal) ────────────────────────────────────────────────

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

function positiveIntFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const REDIS_URL     = requireEnv('REDIS_URL')
requireEnv('DATABASE_URL') // ensures Prisma has it at startup
const MINIO_ENDPOINT  = requireEnv('MINIO_ENDPOINT')
const MINIO_PORT      = parseInt(process.env.MINIO_PORT ?? '9000', 10)
const MINIO_USE_SSL   = process.env.MINIO_USE_SSL === 'true'
const MINIO_ACCESS_KEY = requireEnv('MINIO_ACCESS_KEY')
const MINIO_SECRET_KEY = requireEnv('MINIO_SECRET_KEY')
const BUCKET          = process.env.MINIO_BUCKET ?? 'snackspot'
const QUEUE_NAME      = 'photo-processing'
const MAX_ORIGINAL_BYTES = positiveIntFromEnv('MAX_FILE_SIZE_BYTES', 10 * 1024 * 1024)
const MAX_INPUT_PIXELS = positiveIntFromEnv('MAX_INPUT_PIXELS', 40_000_000)

// ─── Clients ─────────────────────────────────────────────────────────────────

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null })
const prisma = new PrismaClient()
const minio = new Minio.Client({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: MINIO_USE_SSL,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
})

// ─── Variant config ───────────────────────────────────────────────────────────

interface Variant { name: string; width: number; quality: number }

const VARIANTS: Variant[] = [
  { name: 'thumb',  width: 256,  quality: 80 },
  { name: 'medium', width: 1024, quality: 85 },
  { name: 'large',  width: 2048, quality: 90 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function downloadToBuffer(key: string): Promise<Buffer> {
  const stream = await minio.getObject(BUCKET, key)
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

async function uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await minio.putObject(BUCKET, key, buffer, buffer.length, { 'Content-Type': contentType })
}

// ─── Processor ───────────────────────────────────────────────────────────────

interface PhotoJob {
  photoId: string
  storageKey: string
  uploaderId: string
}

async function processPhoto(job: Job<PhotoJob>): Promise<void> {
  const { photoId, storageKey } = job.data
  const jobLog = log.child({ photoId, storageKey, jobId: job.id })

  jobLog.info('Processing photo')

  // Reject oversized objects before loading them into memory.
  const stat = await minio.statObject(BUCKET, storageKey)
  if (stat.size > MAX_ORIGINAL_BYTES) {
    throw new Error(`Original too large: ${stat.size} bytes`)
  }

  // 1. Download original
  let originalBuffer: Buffer
  try {
    originalBuffer = await downloadToBuffer(storageKey)
  } catch (err) {
    jobLog.error({ err }, 'Failed to download original from MinIO')
    throw err
  }

  // 2. Probe original metadata (before any transform)
  const meta = await sharp(originalBuffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()
  const originalWidth  = meta.width ?? 0
  const originalHeight = meta.height ?? 0
  const originalSize   = originalBuffer.length
  jobLog.info({ originalWidth, originalHeight, originalSize }, 'Original probed')

  // Extract base key (everything before the extension) to build variant paths
  // e.g. "originals/<uid>/<uuid>.jpg" → uuid part → "variants/<uuid>/<size>.webp"
  const uuidMatch = storageKey.match(/[^/]+(?=\.[^.]+$)/)
  const uuid = uuidMatch ? uuidMatch[0] : photoId

  // 3. Generate + upload variants
  const variantKeys: Record<string, string> = {}

  for (const variant of VARIANTS) {
    const destKey = `variants/${uuid}/${variant.name}.webp`

    const outputBuffer = await sharp(originalBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate() // auto-rotate from EXIF orientation, then discard EXIF
      .resize({ width: variant.width, withoutEnlargement: true })
      // withMetadata() intentionally omitted: Sharp strips all metadata (incl. GPS) by default
      .webp({ quality: variant.quality, effort: 4 })
      .toBuffer()

    await uploadBuffer(destKey, outputBuffer, 'image/webp')
    variantKeys[variant.name] = destKey
    jobLog.debug({ variant: variant.name, size: outputBuffer.length }, 'Variant uploaded')
  }

  // 4. Update DB record
  await prisma.photo.update({
    where: { id: photoId },
    data: {
      variants: variantKeys,
      metadata: {
        originalWidth,
        originalHeight,
        originalSize,
        contentType: meta.format ?? 'unknown',
      },
      moderationStatus: PhotoModerationStatus.APPROVED,
      processedAt: new Date(),
    },
  })

  jobLog.info({ variantKeys }, 'Photo processed successfully')
}

// ─── Worker ──────────────────────────────────────────────────────────────────

const worker = new Worker<PhotoJob>(QUEUE_NAME, processPhoto, {
  connection: redis,
  concurrency: 3,
})

worker.on('completed', (job) => {
  log.info({ jobId: job.id, photoId: job.data.photoId }, 'Job completed')
})

worker.on('failed', (job, err) => {
  log.error({ jobId: job?.id, photoId: job?.data.photoId, err }, 'Job failed')
  if (!job) return

  const maxAttempts = job.opts.attempts ?? 1
  if (job.attemptsMade >= maxAttempts) {
    void prisma.photo.update({
      where: { id: job.data.photoId },
      data: { moderationStatus: PhotoModerationStatus.REJECTED },
    }).catch((updateErr) => {
      log.error({ photoId: job.data.photoId, err: updateErr }, 'Failed to set photo status to REJECTED')
    })
  }
})

worker.on('error', (err) => {
  log.error({ err }, 'Worker error')
})

// ─── Graceful shutdown ───────────────────────────────────────────────────────

async function shutdown(signal: string) {
  log.info({ signal }, 'Shutting down worker')
  await worker.close()
  await prisma.$disconnect()
  await redis.quit()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

log.info({ queue: QUEUE_NAME, concurrency: 3 }, 'Worker started – waiting for jobs')
