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

import { Worker, Queue, type Job } from 'bullmq'
import Redis from 'ioredis'
import * as Minio from 'minio'
import sharp from 'sharp'
import webpush from 'web-push'
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
const QUEUE_NAME         = 'photo-processing'
const MAX_ORIGINAL_BYTES = positiveIntFromEnv('MAX_FILE_SIZE_BYTES', 10 * 1024 * 1024)
const MAX_INPUT_PIXELS   = positiveIntFromEnv('MAX_INPUT_PIXELS', 40_000_000)
const WORKER_CONCURRENCY = positiveIntFromEnv('WORKER_CONCURRENCY', 3)

// Web push is optional: without a VAPID key pair, push jobs complete as no-ops.
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT ?? 'mailto:contact@snackspot.online'
const PUSH_ENABLED      = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)

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

  let originalBuffer: Buffer
  try {
    originalBuffer = await downloadToBuffer(storageKey)
  } catch (err) {
    jobLog.error({ err }, 'Failed to download original from MinIO')
    throw err
  }

  const meta = await sharp(originalBuffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()
  const originalWidth  = meta.width ?? 0
  const originalHeight = meta.height ?? 0
  const originalSize   = originalBuffer.length
  jobLog.info({ originalWidth, originalHeight, originalSize }, 'Original probed')

  // Extract base key (everything before the extension) to build variant paths
  // e.g. "originals/<uid>/<uuid>.jpg" → uuid part → "variants/<uuid>/<size>.webp"
  const uuidMatch = storageKey.match(/[^/]+(?=\.[^.]+$)/)
  const uuid = uuidMatch ? uuidMatch[0] : photoId

  const variantEntries = await Promise.all(
    VARIANTS.map(async (variant) => {
      const destKey = `variants/${uuid}/${variant.name}.webp`

      const outputBuffer = await sharp(originalBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate() // auto-rotate from EXIF orientation, then discard EXIF
        .resize({ width: variant.width, withoutEnlargement: true })
        // withMetadata() intentionally omitted: Sharp strips all metadata (incl. GPS) by default
        .webp({ quality: variant.quality, effort: 4 })
        .toBuffer()

      await uploadBuffer(destKey, outputBuffer, 'image/webp')
      jobLog.debug({ variant: variant.name, size: outputBuffer.length }, 'Variant uploaded')
      return [variant.name, destKey] as const
    }),
  )

  const variantKeys: Record<string, string> = Object.fromEntries(variantEntries)

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

// ─── Token cleanup ────────────────────────────────────────────────────────────
// Expired refresh tokens and used password-reset tokens accumulate over time.
// A repeatable BullMQ job runs once every 24 h to prune them in small batches,
// keeping the tables lean without acquiring large table locks.

const CLEANUP_QUEUE      = 'token-cleanup'
const CLEANUP_BATCH_SIZE = 500
// 24-hour interval expressed in milliseconds for BullMQ repeat option.
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000
const UNUSED_IMAGE_CUTOFF_MS = positiveIntFromEnv('UNUSED_IMAGE_CUTOFF_MS', 24 * 60 * 60 * 1000)

function avatarVariantKey(avatarKey: string): string {
  const trimmed = avatarKey.replace(/^\/+/, '')
  const lastDot = trimmed.lastIndexOf('.')
  const base = lastDot >= 0 ? trimmed.slice(0, lastDot) : trimmed
  return `${base}.avatar-128.webp`
}

function extractVariantKeys(variants: unknown): string[] {
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return []
  return Object.values(variants)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
}

async function listObjectKeys(prefix: string): Promise<string[]> {
  const stream = minio.listObjectsV2(BUCKET, prefix, true)

  return await new Promise((resolve, reject) => {
    const keys: string[] = []
    stream.on('data', (obj: Minio.BucketItem) => {
      if (obj.name) keys.push(obj.name)
    })
    stream.on('error', (err) => {
      // Tear the stream down so a failed listing doesn't leave it dangling
      // in this long-running process.
      stream.destroy()
      reject(err)
    })
    stream.on('end', () => resolve(keys))
  })
}

async function runTokenCleanup(): Promise<void> {
  const now = new Date()

  // Refresh tokens: delete expired ones and used ones past the theft-detection window.
  // Used tokens are kept for 10 minutes so the family-detection logic in the refresh
  // route can distinguish a legitimate concurrent retry from an actual stolen token.
  const usedTokenCutoff = new Date(now.getTime() - 10 * 60 * 1000)
  let refreshDeleted = 0
  while (true) {
    const expiredIds = await prisma.refreshToken.findMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { usedAt: { lt: usedTokenCutoff } },
        ],
      },
      select: { id: true },
      take: CLEANUP_BATCH_SIZE,
    })
    if (expiredIds.length === 0) break
    const { count } = await prisma.refreshToken.deleteMany({
      where: { id: { in: expiredIds.map((r) => r.id) } },
    })
    refreshDeleted += count
  }

  // Password reset tokens: delete used or expired ones in batches.
  let resetDeleted = 0
  while (true) {
    const expiredIds = await prisma.passwordResetToken.findMany({
      where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] },
      select: { id: true },
      take: CLEANUP_BATCH_SIZE,
    })
    if (expiredIds.length === 0) break
    const { count } = await prisma.passwordResetToken.deleteMany({
      where: { id: { in: expiredIds.map((r) => r.id) } },
    })
    resetDeleted += count
  }

  log.info({ refreshDeleted, resetDeleted }, 'Token cleanup completed')
}

// ─── Orphaned photo cleanup ───────────────────────────────────────────────────

const ORPHAN_PHOTO_CUTOFF_MS = 10 * 60 * 1000

async function runOrphanPhotoCleanup(): Promise<void> {
  const cutoff = new Date(Date.now() - ORPHAN_PHOTO_CUTOFF_MS)
  let photosDeleted = 0

  while (true) {
    const orphans = await prisma.photo.findMany({
      where: { moderationStatus: PhotoModerationStatus.PENDING, createdAt: { lt: cutoff } },
      select: { id: true, storageKey: true },
      take: CLEANUP_BATCH_SIZE,
    })
    if (orphans.length === 0) break

    // Remove originals from MinIO; the object may not exist — swallow the error.
    await Promise.all(
      orphans.map((o: { id: string; storageKey: string }) =>
        minio.removeObject(BUCKET, o.storageKey).catch(() => undefined),
      ),
    )

    const { count } = await prisma.photo.deleteMany({
      where: { id: { in: orphans.map((o: { id: string; storageKey: string }) => o.id) } },
    })
    photosDeleted += count
  }

  log.info({ photosDeleted }, 'Orphaned photo cleanup completed')
}

async function runUnusedImageCleanup(): Promise<void> {
  const cutoff = new Date(Date.now() - UNUSED_IMAGE_CUTOFF_MS)
  let photosDeleted = 0
  let photoObjectsDeleted = 0

  while (true) {
    const stalePhotos = await prisma.photo.findMany({
      where: {
        createdAt: { lt: cutoff },
        reviewPhotos: { none: {} },
        reports: { none: {} },
        // A photo attached to a bite is in active use — never clean it up.
        bite: { is: null },
      },
      select: {
        id: true,
        storageKey: true,
        variants: true,
      },
      take: CLEANUP_BATCH_SIZE,
    })

    if (stalePhotos.length === 0) break

    await Promise.all(
      stalePhotos.flatMap((photo) => {
        const keys = [photo.storageKey, ...extractVariantKeys(photo.variants)]
        return keys.map((key) =>
          minio.removeObject(BUCKET, key)
            .then(() => {
              photoObjectsDeleted += 1
            })
            .catch(() => undefined),
        )
      }),
    )

    const { count } = await prisma.photo.deleteMany({
      where: { id: { in: stalePhotos.map((photo) => photo.id) } },
    })
    photosDeleted += count
  }

  const referencedKeys = new Set<string>()

  const photos = await prisma.photo.findMany({
    select: {
      storageKey: true,
      variants: true,
    },
  })
  for (const photo of photos) {
    referencedKeys.add(photo.storageKey)
    for (const variantKey of extractVariantKeys(photo.variants)) {
      referencedKeys.add(variantKey)
    }
  }

  const usersWithAvatar = await prisma.user.findMany({
    where: { avatarKey: { not: null } },
    select: { avatarKey: true },
  })
  for (const user of usersWithAvatar) {
    if (!user.avatarKey) continue
    referencedKeys.add(user.avatarKey)
    referencedKeys.add(avatarVariantKey(user.avatarKey))
  }

  const existingKeys = [
    ...(await listObjectKeys('originals/')),
    ...(await listObjectKeys('variants/')),
    ...(await listObjectKeys('avatars/')),
  ]

  const orphanKeys = existingKeys.filter((key) => !referencedKeys.has(key))
  await Promise.all(orphanKeys.map((key) => minio.removeObject(BUCKET, key).catch(() => undefined)))

  log.info(
    {
      photosDeleted,
      photoObjectsDeleted,
      referencedObjects: referencedKeys.size,
      orphanObjectsDeleted: orphanKeys.length,
      unusedImageCutoffMs: UNUSED_IMAGE_CUTOFF_MS,
    },
    'Unused image cleanup completed',
  )
}

async function runCleanup(): Promise<void> {
  // Run the tasks sequentially (each batches its own DB/MinIO load), but don't
  // let one failing task skip the others. Any failure is rethrown afterwards so
  // BullMQ still marks the job as failed and the 'failed' handler logs it.
  const tasks: ReadonlyArray<readonly [string, () => Promise<void>]> = [
    ['token cleanup', runTokenCleanup],
    ['orphaned photo cleanup', runOrphanPhotoCleanup],
    ['unused image cleanup', runUnusedImageCleanup],
  ]

  const errors: unknown[] = []
  for (const [name, task] of tasks) {
    try {
      await task()
    } catch (err) {
      log.error({ err, task: name }, 'Cleanup task failed')
      errors.push(err)
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, 'One or more cleanup tasks failed')
  }
}

const cleanupQueue = new Queue(CLEANUP_QUEUE, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 5 },
    removeOnFail: { count: 5 },
  },
})

// Schedule the repeatable cleanup job. BullMQ deduplicates repeatable jobs by
// name + every, so restarting the worker does not create duplicate schedules.
// CommonJS does not support top-level await; any previously registered schedule
// in Redis survives a failed registration and the job still runs on the next tick.
cleanupQueue
  .upsertJobScheduler('cleanup-tokens', { every: CLEANUP_INTERVAL_MS }, { name: 'cleanup-tokens' })
  .catch((err) => log.error({ err }, 'Failed to schedule token cleanup job'))

const cleanupWorker = new Worker(CLEANUP_QUEUE, runCleanup, {
  connection: redis,
  concurrency: 1,
})

cleanupWorker.on('failed', (job, err) => {
  log.error({ jobId: job?.id, err }, 'Daily cleanup job failed')
})

// ─── Web push ────────────────────────────────────────────────────────────────
// The web app enqueues push jobs; this worker resolves the recipient's
// preferences and subscriptions and performs the actual Web Push delivery.
// Expired endpoints (404/410) are pruned on the spot.

if (PUSH_ENABLED) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
} else {
  log.warn('VAPID keys not configured - web push delivery is disabled')
}

const PUSH_QUEUE = 'push-notifications'

type PushCategory = 'LIKE' | 'COMMENT' | 'MENTION' | 'BADGE' | 'STREAK'

interface PushJob {
  userId: string
  category: PushCategory
  title: string
  message: string
  url: string
}

function pushCategoryAllowed(
  category: PushCategory,
  prefs: {
    pushOnLike: boolean
    pushOnComment: boolean
    pushOnMention: boolean
    pushOnBadge: boolean
    pushStreakReminder: boolean
  } | null,
): boolean {
  if (!prefs) return true // no row yet = schema defaults (all on)
  switch (category) {
    case 'LIKE': return prefs.pushOnLike
    case 'COMMENT': return prefs.pushOnComment
    case 'MENTION': return prefs.pushOnMention
    case 'BADGE': return prefs.pushOnBadge
    case 'STREAK': return prefs.pushStreakReminder
  }
}

// Anti-annoyance guardrails (product-vision hoofdstuk 5, B2): a busy day must
// never flood a phone. Streak reminders are exempt from the cap/throttle —
// they already carry their own once-per-local-day dedup.
const SOCIAL_DAILY_PUSH_CAP = 5
const QUIET_HOURS = { from: 22, until: 8 } // local time, [from, until)
const CATEGORY_THROTTLE_SECONDS: Partial<Record<PushCategory, number>> = {
  LIKE: 30 * 60, // a like-storm becomes one heads-up per half hour
  COMMENT: 10 * 60,
}

function localHourAndDate(timezone: string | null): { hour: number; date: string } {
  const tz = timezone ?? 'Europe/Amsterdam'
  try {
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(new Date()),
    )
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
    return { hour, date }
  } catch {
    const now = new Date()
    return { hour: now.getUTCHours(), date: now.toISOString().slice(0, 10) }
  }
}

async function deliverPush(job: PushJob): Promise<void> {
  if (!PUSH_ENABLED) return

  const [user, subscriptions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: job.userId },
      select: {
        timezone: true,
        notificationPreferences: {
          select: {
            pushOnLike: true,
            pushOnComment: true,
            pushOnMention: true,
            pushOnBadge: true,
            pushStreakReminder: true,
          },
        },
      },
    }),
    prisma.pushSubscription.findMany({ where: { userId: job.userId } }),
  ])

  if (!user || subscriptions.length === 0) return
  if (!pushCategoryAllowed(job.category, user.notificationPreferences)) return

  const { hour, date } = localHourAndDate(user.timezone)

  // Quiet hours: never wake anyone between 22:00 and 08:00 local time. The
  // in-app bell and email digest still carry the event.
  if (hour >= QUIET_HOURS.from || hour < QUIET_HOURS.until) return

  if (job.category !== 'STREAK') {
    // Burst throttle per category: only the first event in the window pushes.
    const throttleSeconds = CATEGORY_THROTTLE_SECONDS[job.category]
    if (throttleSeconds) {
      const first = await redis.set(
        `push:throttle:${job.category}:${job.userId}`,
        '1',
        'EX',
        throttleSeconds,
        'NX',
      )
      if (first !== 'OK') return
    }

    // Hard daily cap across all social categories.
    const capKey = `push:daily:${job.userId}:${date}`
    const sentToday = await redis.incr(capKey)
    if (sentToday === 1) await redis.expire(capKey, 36 * 60 * 60)
    if (sentToday > SOCIAL_DAILY_PUSH_CAP) return
  }

  const payload = JSON.stringify({
    title: job.title,
    message: job.message,
    url: job.url,
    tag: `snackspot-${job.category.toLowerCase()}`,
  })

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 3600 },
        )
        await prisma.pushSubscription
          .update({ where: { id: sub.id }, data: { lastUsedAt: new Date() } })
          .catch(() => undefined) // bookkeeping only
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          // The browser revoked this subscription — clean it up.
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined)
        } else {
          log.warn({ err, endpoint: sub.endpoint.slice(0, 48) }, 'Push delivery failed')
        }
      }
    }),
  )
}

const pushWorker = new Worker<PushJob>(PUSH_QUEUE, (job) => deliverPush(job.data), {
  connection: redis,
  concurrency: 5,
})

pushWorker.on('failed', (job, err) => {
  log.error({ jobId: job?.id, err }, 'Push job failed')
})

// ─── Streak reminders ────────────────────────────────────────────────────────
// Hourly sweep: users whose local time is 19:00, with an active streak
// (activity yesterday, nothing yet today) and a push subscription get one
// rescue nudge. Redis SETNX guarantees at most one reminder per local day.

const STREAK_QUEUE = 'streak-reminders'
const STREAK_REMINDER_HOUR = 19

async function runStreakReminders(): Promise<void> {
  if (!PUSH_ENABLED) return

  const candidates = await prisma.$queryRaw<Array<{ id: string; local_date: string }>>`
    SELECT u.id, (NOW() AT TIME ZONE u.timezone)::date::text AS local_date
    FROM users u
    LEFT JOIN notification_preferences np ON np.user_id = u.id
    WHERE u.timezone IS NOT NULL
      AND u.banned_at IS NULL
      AND COALESCE(np.push_streak_reminder, true)
      AND EXTRACT(HOUR FROM (NOW() AT TIME ZONE u.timezone)) = ${STREAK_REMINDER_HOUR}
      AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.id)
      AND (
        EXISTS (
          SELECT 1 FROM bites b
          WHERE b.user_id = u.id AND b.local_date = ((NOW() AT TIME ZONE u.timezone)::date - 1)
        )
        OR EXISTS (
          SELECT 1 FROM reviews r
          WHERE r.user_id = u.id AND r.status = 'PUBLISHED'
            AND (r.created_at AT TIME ZONE u.timezone)::date = ((NOW() AT TIME ZONE u.timezone)::date - 1)
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM bites b2
        WHERE b2.user_id = u.id AND b2.local_date = (NOW() AT TIME ZONE u.timezone)::date
      )
      AND NOT EXISTS (
        SELECT 1 FROM reviews r2
        WHERE r2.user_id = u.id AND r2.status = 'PUBLISHED'
          AND (r2.created_at AT TIME ZONE u.timezone)::date = (NOW() AT TIME ZONE u.timezone)::date
      )
  `

  let sent = 0
  for (const candidate of candidates) {
    // At most one reminder per user per local day, even if the job overlaps.
    const dedupKey = `push:streak:${candidate.id}:${candidate.local_date}`
    const first = await redis.set(dedupKey, '1', 'EX', 86400, 'NX')
    if (first !== 'OK') continue

    await deliverPush({
      userId: candidate.id,
      category: 'STREAK',
      title: 'Your streak is on the line 🔥',
      message: 'One photo of any meal keeps it alive. Still time today.',
      url: '/add-bite',
    })
    sent += 1
  }

  if (candidates.length > 0) {
    log.info({ candidates: candidates.length, sent }, 'Streak reminders processed')
  }
}

const streakQueue = new Queue(STREAK_QUEUE, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 5 },
    removeOnFail: { count: 5 },
  },
})

streakQueue
  .upsertJobScheduler('streak-reminders', { every: 60 * 60 * 1000 }, { name: 'streak-reminders' })
  .catch((err) => log.error({ err }, 'Failed to schedule streak reminder job'))

const streakWorker = new Worker(STREAK_QUEUE, runStreakReminders, {
  connection: redis,
  concurrency: 1,
})

streakWorker.on('failed', (job, err) => {
  log.error({ jobId: job?.id, err }, 'Streak reminder job failed')
})

// ─── Photo worker ─────────────────────────────────────────────────────────────

const worker = new Worker<PhotoJob>(QUEUE_NAME, processPhoto, {
  connection: redis,
  concurrency: WORKER_CONCURRENCY,
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
  await Promise.all([worker.close(), cleanupWorker.close(), pushWorker.close(), streakWorker.close()])
  await Promise.all([cleanupQueue.close(), streakQueue.close()])
  await prisma.$disconnect()
  await redis.quit()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

log.info({ queue: QUEUE_NAME, concurrency: WORKER_CONCURRENCY }, 'Worker started – waiting for jobs')
