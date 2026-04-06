import { type NextRequest } from 'next/server'
import unzipper from 'unzipper'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  type ImportSummary,
  type ImportTableStats,
  type IdMaps,
  CURRENT_SCHEMA_VERSION,
  IMPORT_TABLE_ORDER,
  createEmptyIdMaps,
  remap,
  remapRequired,
} from './types'

export const runtime = 'nodejs'

// ── Helpers ───────────────────────────────────────────────────────

/** Create a fresh stats record for all 18 tables. */
function initTableStats(): Record<string, ImportTableStats> {
  const stats: Record<string, ImportTableStats> = {}
  for (const filename of IMPORT_TABLE_ORDER) {
    stats[filename.replace('.json', '')] = { imported: 0, skipped: 0, errors: [] }
  }
  return stats
}

/**
 * Find a file in the unzipper central directory by path, read it,
 * parse as JSON array. Throws if missing or not a valid JSON array.
 */
async function parseZipEntry(
  directory: unzipper.CentralDirectory,
  path: string,
): Promise<unknown[]> {
  const entry = directory.files.find(f => f.path === path)
  if (!entry) throw new Error(`Ontbrekend bestand in archief: ${path}`)
  const buf = await entry.buffer()
  const parsed = JSON.parse(buf.toString('utf-8'))
  if (!Array.isArray(parsed)) throw new Error(`${path} is geen JSON-array`)
  return parsed
}

// ── POST handler ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth guard — must be admin (per T-02-01)
  const auth = requireAdmin(req)
  if (auth instanceof Response) return auth

  // ── Parse uploaded file ───────────────────────────────────────

  const formData = await req.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'Geen bestand geupload' }, { status: 422 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // ── Parse ZIP ─────────────────────────────────────────────────

  let directory: unzipper.CentralDirectory
  try {
    directory = await unzipper.Open.buffer(buffer)
  } catch {
    return Response.json({ error: 'Ongeldig ZIP-archief' }, { status: 422 })
  }

  // ── Parse and validate manifest (per D-04, IMP-02) ───────────

  let manifest: { schemaVersion: number; exportedAt: string; tables: string[] }
  try {
    const manifestEntry = directory.files.find(f => f.path === 'manifest.json')
    if (!manifestEntry) {
      return Response.json({ error: 'manifest.json ontbreekt in het archief' }, { status: 422 })
    }
    const manifestBuf = await manifestEntry.buffer()
    manifest = JSON.parse(manifestBuf.toString('utf-8'))
  } catch {
    return Response.json({ error: 'manifest.json kon niet worden gelezen' }, { status: 422 })
  }

  if (manifest.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return Response.json(
      {
        error: `Schema versie komt niet overeen. Verwacht: ${CURRENT_SCHEMA_VERSION}, ontvangen: ${manifest.schemaVersion}`,
      },
      { status: 422 },
    )
  }

  // ── Parse all 18 data files before any DB writes (per D-04, IMP-02) ──

  const tableData = new Map<string, unknown[]>()
  for (const filename of IMPORT_TABLE_ORDER) {
    try {
      const records = await parseZipEntry(directory, `data/${filename}`)
      tableData.set(filename, records)
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : `Fout bij het lezen van ${filename}` },
        { status: 422 },
      )
    }
  }

  // ── Duplicate-detection pre-loading (per D-07, D-08) ─────────
  // Load before opening the transaction — these queries run outside the TX

  // Users: deduplicate by email (case-insensitive)
  const existingUsers = await db.user.findMany({ select: { id: true, email: true } })
  const existingUsersByEmail = new Map<string, string>()
  for (const u of existingUsers) {
    existingUsersByEmail.set(u.email.toLowerCase(), u.id)
  }

  // Places: deduplicate by name+address
  const rawPlaces = await db.$queryRaw<Array<{ id: string; name: string; address: string }>>`
    SELECT id, name, address FROM places
  `
  const existingPlacesByKey = new Map<string, string>()
  for (const p of rawPlaces) {
    existingPlacesByKey.set(`${p.name}::${p.address}`, p.id)
  }

  // Badges: deduplicate by slug
  const existingBadges = await db.badge.findMany({ select: { id: true, slug: true } })
  const existingBadgesBySlug = new Map<string, string>()
  for (const b of existingBadges) {
    existingBadgesBySlug.set(b.slug, b.id)
  }

  // Photos: deduplicate by storageKey
  const existingPhotos = await db.photo.findMany({ select: { id: true, storageKey: true } })
  const existingPhotosByKey = new Map<string, string>()
  for (const ph of existingPhotos) {
    existingPhotosByKey.set(ph.storageKey, ph.id)
  }

  // ── Transaction (per D-05, IMP-09) ───────────────────────────

  const tableStats = initTableStats()
  const idMaps: IdMaps = createEmptyIdMaps()

  try {
    const result = await db.$transaction(async (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => {
      // ── 1. users.json (per D-07, D-09, D-10) ──────────────────
      const users = tableData.get('users.json')!
      for (const r of users as any[]) {
        const existingId = existingUsersByEmail.get(r.email.toLowerCase())
        if (existingId) {
          idMaps.users.set(r.id, existingId)
          tableStats['users'].skipped++
          continue
        }
        const created = await tx.user.create({
          data: {
            email: r.email,
            username: r.username,
            bio: r.bio ?? null,
            usernameChangedAt: r.usernameChangedAt ? new Date(r.usernameChangedAt) : null,
            passwordHash: r.passwordHash,
            role: r.role,
            isVerified: r.isVerified,
            avatarKey: r.avatarKey ?? null,
            bannedAt: r.bannedAt ? new Date(r.bannedAt) : null,
            emailVerifiedAt: r.emailVerifiedAt ? new Date(r.emailVerifiedAt) : null,
            createdAt: new Date(r.createdAt),
            updatedAt: new Date(r.updatedAt),
          },
          select: { id: true },
        })
        idMaps.users.set(r.id, created.id)
        tableStats['users'].imported++
      }

      // ── 2. places.json (per D-08, D-09 — raw SQL for PostGIS) ─
      const places = tableData.get('places.json')!
      for (const r of places as any[]) {
        const placeKey = `${r.name}::${r.address}`
        const existingId = existingPlacesByKey.get(placeKey)
        if (existingId) {
          idMaps.places.set(r.id, existingId)
          tableStats['places'].skipped++
          continue
        }
        // CRITICAL: ST_MakePoint takes (longitude, latitude) — lng before lat
        const [created] = await tx.$queryRaw<Array<{ id: string }>>`
          INSERT INTO places (name, address, location, created_at, updated_at)
          VALUES (
            ${r.name},
            ${r.address},
            ST_SetSRID(ST_MakePoint(${r.location.lng}, ${r.location.lat}), 4326)::geography,
            ${new Date(r.createdAt)},
            ${new Date(r.updatedAt)}
          )
          RETURNING id
        `
        idMaps.places.set(r.id, created.id)
        tableStats['places'].imported++
      }

      // ── 3. reviews.json — dedup by userId+placeId+createdAt ───
      const reviews = tableData.get('reviews.json')!
      for (const r of reviews as any[]) {
        const mappedUserId = remapRequired(idMaps.users, r.userId, 'review.userId')
        const mappedPlaceId = remapRequired(idMaps.places, r.placeId, 'review.placeId')
        const createdAt = new Date(r.createdAt)
        const existing = await tx.review.findFirst({
          where: { userId: mappedUserId, placeId: mappedPlaceId, createdAt },
          select: { id: true },
        })
        if (existing) {
          idMaps.reviews.set(r.id, existing.id)
          tableStats['reviews'].skipped++
          continue
        }
        const created = await tx.review.create({
          data: {
            userId: mappedUserId,
            placeId: mappedPlaceId,
            rating: r.rating,
            ratingTaste: r.ratingTaste,
            ratingValue: r.ratingValue,
            ratingPortion: r.ratingPortion,
            ratingService: r.ratingService ?? null,
            ratingOverall: r.ratingOverall,
            text: r.text,
            dishName: r.dishName ?? null,
            status: r.status,
            createdAt,
            updatedAt: new Date(r.updatedAt),
          },
          select: { id: true },
        })
        idMaps.reviews.set(r.id, created.id)
        tableStats['reviews'].imported++
      }

      // ── 4. photos.json — dedup by storageKey ──────────────────
      const photos = tableData.get('photos.json')!
      for (const r of photos as any[]) {
        const existingId = existingPhotosByKey.get(r.storageKey)
        if (existingId) {
          idMaps.photos.set(r.id, existingId)
          tableStats['photos'].skipped++
          continue
        }
        const created = await tx.photo.create({
          data: {
            storageKey: r.storageKey,
            uploaderId: remapRequired(idMaps.users, r.uploaderId, 'photo.uploaderId'),
            variants: r.variants ?? {},
            metadata: r.metadata ?? {},
            moderationStatus: r.moderationStatus,
            processedAt: r.processedAt ? new Date(r.processedAt) : null,
            createdAt: new Date(r.createdAt),
          },
          select: { id: true },
        })
        idMaps.photos.set(r.id, created.id)
        tableStats['photos'].imported++
      }

      // ── 5. review-photos.json — compound PK (reviewId, photoId) ─
      const reviewPhotos = tableData.get('review-photos.json')!
      const remappedReviewPhotos = (reviewPhotos as any[]).map(r => ({
        reviewId: remapRequired(idMaps.reviews, r.reviewId, 'reviewPhoto.reviewId'),
        photoId: remapRequired(idMaps.photos, r.photoId, 'reviewPhoto.photoId'),
        sortOrder: r.sortOrder ?? 0,
      }))
      const rpResult = await tx.reviewPhoto.createMany({ data: remappedReviewPhotos, skipDuplicates: true })
      tableStats['review-photos'].imported = rpResult.count

      // ── 6. comments.json — dedup by userId+reviewId+createdAt ─
      const comments = tableData.get('comments.json')!
      for (const r of comments as any[]) {
        const mappedUserId = remapRequired(idMaps.users, r.userId, 'comment.userId')
        const mappedReviewId = remapRequired(idMaps.reviews, r.reviewId, 'comment.reviewId')
        const createdAt = new Date(r.createdAt)
        const existing = await tx.comment.findFirst({
          where: { userId: mappedUserId, reviewId: mappedReviewId, createdAt },
          select: { id: true },
        })
        if (existing) {
          idMaps.comments.set(r.id, existing.id)
          tableStats['comments'].skipped++
          continue
        }
        const created = await tx.comment.create({
          data: {
            userId: mappedUserId,
            reviewId: mappedReviewId,
            text: r.text,
            createdAt,
            updatedAt: new Date(r.updatedAt),
          },
          select: { id: true },
        })
        idMaps.comments.set(r.id, created.id)
        tableStats['comments'].imported++
      }

      // ── 7. badges.json — dedup by slug ─────────────────────────
      const badges = tableData.get('badges.json')!
      for (const r of badges as any[]) {
        const existingId = existingBadgesBySlug.get(r.slug)
        if (existingId) {
          idMaps.badges.set(r.id, existingId)
          tableStats['badges'].skipped++
          continue
        }
        const created = await tx.badge.create({
          data: {
            slug: r.slug,
            name: r.name,
            description: r.description,
            iconKey: r.iconKey,
            tier: r.tier,
            criteriaType: r.criteriaType,
            criteriaValue: r.criteriaValue,
            isActive: r.isActive,
            createdAt: new Date(r.createdAt),
          },
          select: { id: true },
        })
        idMaps.badges.set(r.id, created.id)
        tableStats['badges'].imported++
      }

      // ── 8. user-badges.json — compound PK (userId, badgeId) ───
      const userBadges = tableData.get('user-badges.json')!
      const remappedUserBadges = (userBadges as any[]).map(r => ({
        userId: remapRequired(idMaps.users, r.userId, 'userBadge.userId'),
        badgeId: remapRequired(idMaps.badges, r.badgeId, 'userBadge.badgeId'),
        progressCurrent: r.progressCurrent,
        progressTarget: r.progressTarget,
        earnedAt: r.earnedAt ? new Date(r.earnedAt) : null,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      }))
      const ubResult = await tx.userBadge.createMany({ data: remappedUserBadges, skipDuplicates: true })
      tableStats['user-badges'].imported = ubResult.count

      // ── 9. review-likes.json — compound PK (userId, reviewId) ─
      const reviewLikes = tableData.get('review-likes.json')!
      const remappedReviewLikes = (reviewLikes as any[]).map(r => ({
        userId: remapRequired(idMaps.users, r.userId, 'reviewLike.userId'),
        reviewId: remapRequired(idMaps.reviews, r.reviewId, 'reviewLike.reviewId'),
        createdAt: new Date(r.createdAt),
      }))
      const rlResult = await tx.reviewLike.createMany({ data: remappedReviewLikes, skipDuplicates: true })
      tableStats['review-likes'].imported = rlResult.count

      // ── 10. favorites.json — compound PK (userId, placeId) ────
      const favorites = tableData.get('favorites.json')!
      const remappedFavorites = (favorites as any[]).map(r => ({
        userId: remapRequired(idMaps.users, r.userId, 'favorite.userId'),
        placeId: remapRequired(idMaps.places, r.placeId, 'favorite.placeId'),
        createdAt: new Date(r.createdAt),
      }))
      const fResult = await tx.favorite.createMany({ data: remappedFavorites, skipDuplicates: true })
      tableStats['favorites'].imported = fResult.count

      // ── 11. reports.json — dedup by reporterId+targetType+createdAt
      const reports = tableData.get('reports.json')!
      for (const r of reports as any[]) {
        const mappedReporterId = remapRequired(idMaps.users, r.reporterId, 'report.reporterId')
        const createdAt = new Date(r.createdAt)
        const existing = await tx.report.findFirst({
          where: { reporterId: mappedReporterId, targetType: r.targetType, createdAt },
          select: { id: true },
        })
        if (existing) {
          idMaps.reports.set(r.id, existing.id)
          tableStats['reports'].skipped++
          continue
        }
        const created = await tx.report.create({
          data: {
            reporterId: mappedReporterId,
            targetType: r.targetType,
            reviewId: remap(idMaps.reviews, r.reviewId),
            photoId: remap(idMaps.photos, r.photoId),
            reason: r.reason,
            status: r.status,
            createdAt,
          },
          select: { id: true },
        })
        idMaps.reports.set(r.id, created.id)
        tableStats['reports'].imported++
      }

      // ── 12. moderation-actions.json — dedup by moderatorId+actionType+targetId+createdAt
      const moderationActions = tableData.get('moderation-actions.json')!
      for (const r of moderationActions as any[]) {
        const mappedModeratorId = remapRequired(idMaps.users, r.moderatorId, 'moderationAction.moderatorId')
        const createdAt = new Date(r.createdAt)
        const existing = await tx.moderationAction.findFirst({
          where: { moderatorId: mappedModeratorId, actionType: r.actionType, targetId: r.targetId, createdAt },
          select: { id: true },
        })
        if (existing) {
          idMaps.moderationActions.set(r.id, existing.id)
          tableStats['moderation-actions'].skipped++
          continue
        }
        const created = await tx.moderationAction.create({
          data: {
            moderatorId: mappedModeratorId,
            actionType: r.actionType,
            targetType: r.targetType,
            targetId: r.targetId,
            note: r.note ?? null,
            createdAt,
          },
          select: { id: true },
        })
        idMaps.moderationActions.set(r.id, created.id)
        tableStats['moderation-actions'].imported++
      }

      // ── 13. notifications.json — dedup by userId+type+createdAt ─
      const notifications = tableData.get('notifications.json')!
      for (const r of notifications as any[]) {
        const mappedUserId = remapRequired(idMaps.users, r.userId, 'notification.userId')
        const createdAt = new Date(r.createdAt)
        const existing = await tx.notification.findFirst({
          where: { userId: mappedUserId, type: r.type, createdAt },
          select: { id: true },
        })
        if (existing) {
          idMaps.notifications.set(r.id, existing.id)
          tableStats['notifications'].skipped++
          continue
        }
        const created = await tx.notification.create({
          data: {
            userId: mappedUserId,
            type: r.type,
            title: r.title,
            message: r.message,
            link: r.link ?? null,
            isRead: r.isRead,
            actorId: remap(idMaps.users, r.actorId),
            reviewId: remap(idMaps.reviews, r.reviewId),
            commentId: remap(idMaps.comments, r.commentId),
            createdAt,
          },
          select: { id: true },
        })
        idMaps.notifications.set(r.id, created.id)
        tableStats['notifications'].imported++
      }

      // ── 14. notification-preferences.json — PK is userId ──────
      const notifPrefs = tableData.get('notification-preferences.json')!
      const remappedNotifPrefs = (notifPrefs as any[]).map(r => ({
        userId: remapRequired(idMaps.users, r.userId, 'notificationPreferences.userId'),
        emailOnLike: r.emailOnLike,
        emailOnComment: r.emailOnComment,
        emailOnMention: r.emailOnMention,
        emailOnBadge: r.emailOnBadge,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      }))
      const npResult = await tx.notificationPreferences.createMany({ data: remappedNotifPrefs, skipDuplicates: true })
      tableStats['notification-preferences'].imported = npResult.count

      // ── 15. review-mentions.json — dedup by @@unique(reviewId, mentionedUserId)
      const reviewMentions = tableData.get('review-mentions.json')!
      for (const r of reviewMentions as any[]) {
        const mappedReviewId = remapRequired(idMaps.reviews, r.reviewId, 'reviewMention.reviewId')
        const mappedMentionedUserId = remapRequired(idMaps.users, r.mentionedUserId, 'reviewMention.mentionedUserId')
        const existing = await tx.reviewMention.findUnique({
          where: { reviewId_mentionedUserId: { reviewId: mappedReviewId, mentionedUserId: mappedMentionedUserId } },
          select: { id: true },
        })
        if (existing) {
          idMaps.reviewMentions.set(r.id, existing.id)
          tableStats['review-mentions'].skipped++
          continue
        }
        const created = await tx.reviewMention.create({
          data: {
            reviewId: mappedReviewId,
            mentionedUserId: mappedMentionedUserId,
            mentionedByUserId: remapRequired(idMaps.users, r.mentionedByUserId, 'reviewMention.mentionedByUserId'),
            createdAt: new Date(r.createdAt),
          },
          select: { id: true },
        })
        idMaps.reviewMentions.set(r.id, created.id)
        tableStats['review-mentions'].imported++
      }

      // ── 16. review-tags.json — compound PK (reviewId, tag) ────
      const reviewTags = tableData.get('review-tags.json')!
      const remappedReviewTags = (reviewTags as any[]).map(r => ({
        reviewId: remapRequired(idMaps.reviews, r.reviewId, 'reviewTag.reviewId'),
        tag: r.tag,
        createdAt: new Date(r.createdAt),
      }))
      const rtResult = await tx.reviewTag.createMany({ data: remappedReviewTags, skipDuplicates: true })
      tableStats['review-tags'].imported = rtResult.count

      // ── 17. blocked-words.json — dedup by word (@unique) ───────
      const blockedWords = tableData.get('blocked-words.json')!
      for (const r of blockedWords as any[]) {
        const existing = await tx.blockedWord.findUnique({
          where: { word: r.word },
          select: { id: true },
        })
        if (existing) {
          idMaps.blockedWords.set(r.id, existing.id)
          tableStats['blocked-words'].skipped++
          continue
        }
        const created = await tx.blockedWord.create({
          data: {
            word: r.word,
            createdBy: remapRequired(idMaps.users, r.createdBy, 'blockedWord.createdBy'),
            createdAt: new Date(r.createdAt),
          },
          select: { id: true },
        })
        idMaps.blockedWords.set(r.id, created.id)
        tableStats['blocked-words'].imported++
      }

      // ── 18. flagged-comments.json — dedup by commentId (@unique) ─
      const flaggedComments = tableData.get('flagged-comments.json')!
      for (const r of flaggedComments as any[]) {
        const mappedCommentId = remapRequired(idMaps.comments, r.commentId, 'flaggedComment.commentId')
        const existing = await tx.flaggedComment.findUnique({
          where: { commentId: mappedCommentId },
          select: { id: true },
        })
        if (existing) {
          idMaps.flaggedComments.set(r.id, existing.id)
          tableStats['flagged-comments'].skipped++
          continue
        }
        const created = await tx.flaggedComment.create({
          data: {
            commentId: mappedCommentId,
            matchedWord: r.matchedWord,
            status: r.status,
            reviewedBy: remap(idMaps.users, r.reviewedBy),
            reviewedAt: r.reviewedAt ? new Date(r.reviewedAt) : null,
            createdAt: new Date(r.createdAt),
          },
          select: { id: true },
        })
        idMaps.flaggedComments.set(r.id, created.id)
        tableStats['flagged-comments'].imported++
      }

      // ── Build summary ──────────────────────────────────────────
      let totalImported = 0
      let totalSkipped = 0
      for (const stats of Object.values(tableStats)) {
        totalImported += stats.imported
        totalSkipped += stats.skipped
      }

      const summary: ImportSummary = {
        success: true,
        schemaVersion: manifest.schemaVersion,
        exportedAt: manifest.exportedAt,
        tablesProcessed: IMPORT_TABLE_ORDER.length,
        totalImported,
        totalSkipped,
        tables: tableStats,
      }
      return summary
    }, { timeout: 60000, maxWait: 10000 })

    return Response.json(result)
  } catch (error) {
    return Response.json({
      success: false,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: '',
      tablesProcessed: 0,
      totalImported: 0,
      totalSkipped: 0,
      tables: {},
      error: error instanceof Error ? error.message : 'Onbekende fout bij het importeren',
    } satisfies ImportSummary, { status: 500 })
  }
}
