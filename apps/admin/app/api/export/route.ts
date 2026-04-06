import { type NextRequest } from 'next/server'
import { PassThrough, Readable } from 'node:stream'
import archiver from 'archiver'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { minioClient, BUCKET } from '@/lib/minio'

export const runtime = 'nodejs'

// ── Manifest type ────────────────────────────────────────────────

interface ExportManifest {
  schemaVersion: number
  exportedAt: string
  tables: string[]
  counts: Record<string, number>
  photosCount: number
  photosSkipped: number
  objectsCount: number
  objectsSkipped: number
}

function avatarVariantKey(avatarKey: string): string {
  const trimmed = avatarKey.replace(/^\/+/, '')
  const lastDot = trimmed.lastIndexOf('.')
  const base = lastDot >= 0 ? trimmed.slice(0, lastDot) : trimmed
  return `${base}.avatar-128.webp`
}

function extractVariantKeys(variants: unknown): string[] {
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return []
  return Object.values(variants as Record<string, unknown>).filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  )
}

// ── Table names (data/*.json filenames in the ZIP) ───────────────

const TABLE_FILES = [
  'users.json',
  'places.json',
  'reviews.json',
  'photos.json',
  'review-photos.json',
  'comments.json',
  'badges.json',
  'user-badges.json',
  'review-likes.json',
  'favorites.json',
  'reports.json',
  'moderation-actions.json',
  'notifications.json',
  'notification-preferences.json',
  'review-mentions.json',
  'review-tags.json',
  'blocked-words.json',
  'flagged-comments.json',
]

// ── Core export builder ──────────────────────────────────────────

async function buildExport(
  archive: archiver.Archiver,
  pass: PassThrough,
): Promise<void> {
  try {
    const counts: Record<string, number> = {}

    // 1. users
    const users = await db.user.findMany()
    counts['users'] = users.length
    archive.append(JSON.stringify(users, null, 2), { name: 'data/users.json' })

    // 2. places — PostGIS geography requires raw SQL with ST_Y/ST_X (per D-09, EXP-03)
    const rawPlaces = await db.$queryRaw<Array<{
      id: string
      name: string
      address: string
      lat: number
      lng: number
      created_at: Date
      updated_at: Date
    }>>`
      SELECT id, name, address,
        ST_Y(location::geometry) AS lat,
        ST_X(location::geometry) AS lng,
        created_at, updated_at
      FROM places
    `
    const places = rawPlaces.map((p: { id: string; name: string; address: string; lat: number; lng: number; created_at: Date; updated_at: Date }) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      location: { lat: p.lat, lng: p.lng },
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }))
    counts['places'] = places.length
    archive.append(JSON.stringify(places, null, 2), { name: 'data/places.json' })

    // 3. reviews — Decimal fields must be converted to numbers (per D-08, EXP-04)
    const rawReviews = await db.review.findMany()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rawReviews typed via Prisma when generated; any used as fallback when @prisma/client not yet generated
    const reviews = rawReviews.map((r: any) => ({
      ...r,
      rating: Number(r.rating),
      ratingTaste: Number(r.ratingTaste),
      ratingValue: Number(r.ratingValue),
      ratingPortion: Number(r.ratingPortion),
      ratingService: r.ratingService === null ? null : Number(r.ratingService),
      ratingOverall: Number(r.ratingOverall),
    }))
    counts['reviews'] = reviews.length
    archive.append(JSON.stringify(reviews, null, 2), { name: 'data/reviews.json' })

    // 4. photos — variants and metadata are Json type, export as-is (per D-10)
    const photos = await db.photo.findMany()
    counts['photos'] = photos.length
    archive.append(JSON.stringify(photos, null, 2), { name: 'data/photos.json' })

    // 5. review-photos
    const reviewPhotos = await db.reviewPhoto.findMany()
    counts['review-photos'] = reviewPhotos.length
    archive.append(JSON.stringify(reviewPhotos, null, 2), { name: 'data/review-photos.json' })

    // 6. comments
    const comments = await db.comment.findMany()
    counts['comments'] = comments.length
    archive.append(JSON.stringify(comments, null, 2), { name: 'data/comments.json' })

    // 7. badges
    const badges = await db.badge.findMany()
    counts['badges'] = badges.length
    archive.append(JSON.stringify(badges, null, 2), { name: 'data/badges.json' })

    // 8. user-badges
    const userBadges = await db.userBadge.findMany()
    counts['user-badges'] = userBadges.length
    archive.append(JSON.stringify(userBadges, null, 2), { name: 'data/user-badges.json' })

    // 9. review-likes
    const reviewLikes = await db.reviewLike.findMany()
    counts['review-likes'] = reviewLikes.length
    archive.append(JSON.stringify(reviewLikes, null, 2), { name: 'data/review-likes.json' })

    // 10. favorites
    const favorites = await db.favorite.findMany()
    counts['favorites'] = favorites.length
    archive.append(JSON.stringify(favorites, null, 2), { name: 'data/favorites.json' })

    // 11. reports
    const reports = await db.report.findMany()
    counts['reports'] = reports.length
    archive.append(JSON.stringify(reports, null, 2), { name: 'data/reports.json' })

    // 12. moderation-actions
    const moderationActions = await db.moderationAction.findMany()
    counts['moderation-actions'] = moderationActions.length
    archive.append(JSON.stringify(moderationActions, null, 2), { name: 'data/moderation-actions.json' })

    // 13. notifications
    const notifications = await db.notification.findMany()
    counts['notifications'] = notifications.length
    archive.append(JSON.stringify(notifications, null, 2), { name: 'data/notifications.json' })

    // 14. notification-preferences
    const notificationPreferences = await db.notificationPreferences.findMany()
    counts['notification-preferences'] = notificationPreferences.length
    archive.append(JSON.stringify(notificationPreferences, null, 2), { name: 'data/notification-preferences.json' })

    // 15. review-mentions
    const reviewMentions = await db.reviewMention.findMany()
    counts['review-mentions'] = reviewMentions.length
    archive.append(JSON.stringify(reviewMentions, null, 2), { name: 'data/review-mentions.json' })

    // 16. review-tags
    const reviewTags = await db.reviewTag.findMany()
    counts['review-tags'] = reviewTags.length
    archive.append(JSON.stringify(reviewTags, null, 2), { name: 'data/review-tags.json' })

    // 17. blocked-words
    const blockedWords = await db.blockedWord.findMany()
    counts['blocked-words'] = blockedWords.length
    archive.append(JSON.stringify(blockedWords, null, 2), { name: 'data/blocked-words.json' })

    // 18. flagged-comments
    const flaggedComments = await db.flaggedComment.findMany()
    counts['flagged-comments'] = flaggedComments.length
    archive.append(JSON.stringify(flaggedComments, null, 2), { name: 'data/flagged-comments.json' })

    // ── Stream photos from MinIO (per EXP-05, D-05, D-11, D-12) ─────

    const allPhotos = await db.photo.findMany({ select: { id: true, storageKey: true, variants: true } })
    let photosExported = 0
    let photosSkipped = 0
    let objectsExported = 0
    let objectsSkipped = 0

    for (const photo of allPhotos) {
      try {
        const stream = await minioClient.getObject(BUCKET, photo.storageKey)
        archive.append(stream, { name: `photos/${photo.storageKey}` })
        photosExported++
      } catch {
        photosSkipped++
        // eslint-disable-next-line no-console -- export skips are intentional operational warnings
        console.error(`Export: skipped missing photo ${photo.id} (key: ${photo.storageKey})`)
      }
    }

    // Export additional assets used by the UI (photo variants + avatars).
    const objectKeys = new Set<string>()
    for (const photo of allPhotos) {
      for (const key of extractVariantKeys(photo.variants)) objectKeys.add(key)
    }
    for (const user of users) {
      if (!user.avatarKey) continue
      objectKeys.add(user.avatarKey)
      objectKeys.add(avatarVariantKey(user.avatarKey))
    }

    for (const key of objectKeys) {
      try {
        const stream = await minioClient.getObject(BUCKET, key)
        archive.append(stream, { name: `objects/${key}` })
        objectsExported++
      } catch {
        objectsSkipped++
        // eslint-disable-next-line no-console -- export skips are intentional operational warnings
        console.warn(`Export: skipped missing object ${key}`)
      }
    }

    // ── Manifest (per EXP-08, INF-03, D-03) ──────────────────────────

    const manifest: ExportManifest = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      tables: TABLE_FILES,
      counts,
      photosCount: photosExported,
      photosSkipped,
      objectsCount: objectsExported,
      objectsSkipped,
    }
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })

    await archive.finalize()
  } catch (err) {
    archive.abort()
    pass.destroy(err instanceof Error ? err : new Error(String(err)))
  }
}

// ── GET handler ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth guard — must be admin (per INF-01, T-01-01)
  const auth = requireAdmin(req)
  if (auth instanceof Response) return auth

  const pass = new PassThrough()
  const archive = archiver('zip', { zlib: { level: 6 } })

  // Forward archiver errors to the PassThrough stream
  archive.on('error', (err) => {
    pass.destroy(err)
  })
  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      // eslint-disable-next-line no-console -- archiver warnings are operational
      console.warn('Export archiver warning:', err.message)
    } else {
      pass.destroy(err)
    }
  })

  // Pipe compressed ZIP output into the PassThrough (which becomes the HTTP response body)
  archive.pipe(pass)

  // Build export asynchronously — do NOT await here so the response starts streaming immediately
  buildExport(archive, pass).catch((err) => pass.destroy(err))

  return new Response(Readable.toWeb(pass) as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="snackspot-export-${Date.now()}.zip"`,
    },
  })
}
