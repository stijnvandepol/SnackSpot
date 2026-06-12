import { type NextRequest } from 'next/server'
import { PassThrough, Readable } from 'node:stream'
import archiver from 'archiver'
import { prisma } from '@/lib/db'
import { err, requireAuth, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'
import { minioClient, BUCKET } from '@/lib/minio'
import { buildExportFiles } from '@/lib/export-data'
import { logPrivacyAction } from '@/lib/privacy-audit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET /api/v1/me/export — per-user data export (GDPR Art. 15 access /
// Art. 20 portability): a ZIP with all personal data as machine-readable
// JSON plus every photo the user uploaded. Same streaming pattern as the
// admin export so large exports never buffer fully in memory.

async function buildUserExport(userId: string, archive: archiver.Archiver): Promise<void> {
  const [
    user,
    notificationPreferences,
    reviews,
    comments,
    reviewLikes,
    favorites,
    bites,
    photos,
    badges,
    userStats,
    xpEvents,
    notifications,
    following,
    followers,
    reports,
    pushSubscriptions,
    userQuests,
    userCollectibles,
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true, email: true, username: true, bio: true, avatarKey: true,
        timezone: true, role: true, isVerified: true, emailVerifiedAt: true,
        usernameChangedAt: true, createdAt: true, updatedAt: true,
      },
    }),
    prisma.notificationPreferences.findUnique({
      where: { userId },
      select: {
        emailOnLike: true, emailOnComment: true, emailOnMention: true, emailOnBadge: true,
        pushOnLike: true, pushOnComment: true, pushOnMention: true, pushOnBadge: true,
        pushStreakReminder: true,
      },
    }),
    prisma.review.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, text: true, dishName: true, status: true,
        rating: true, ratingTaste: true, ratingValue: true, ratingPortion: true,
        ratingService: true, ratingOverall: true,
        deletedAt: true, createdAt: true, updatedAt: true,
        place: { select: { name: true, address: true } },
        tags: { select: { tag: true } },
        reviewPhotos: { select: { photoId: true } },
      },
    }),
    prisma.comment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, reviewId: true, text: true, createdAt: true },
    }),
    prisma.reviewLike.findMany({
      where: { userId },
      select: { reviewId: true, createdAt: true },
    }),
    prisma.favorite.findMany({
      where: { userId },
      select: { createdAt: true, place: { select: { name: true, address: true } } },
    }),
    prisma.bite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, photoId: true, mealSlot: true, note: true, visibility: true,
        localDate: true, createdAt: true,
        place: { select: { name: true, address: true } },
      },
    }),
    prisma.photo.findMany({
      where: { uploaderId: userId },
      select: { id: true, storageKey: true, moderationStatus: true, createdAt: true },
    }),
    prisma.userBadge.findMany({
      where: { userId },
      select: {
        progressCurrent: true, progressTarget: true, earnedAt: true,
        badge: { select: { name: true, description: true, tier: true } },
      },
    }),
    prisma.userStats.findUnique({
      where: { userId },
      select: { xpTotal: true, level: true, bitesCount: true },
    }),
    prisma.xpEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { amount: true, reason: true, createdAt: true },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { type: true, title: true, message: true, isRead: true, createdAt: true },
    }),
    prisma.follow.findMany({
      where: { followerId: userId },
      select: { createdAt: true, followee: { select: { username: true } } },
    }),
    prisma.follow.findMany({
      where: { followeeId: userId },
      select: { createdAt: true, follower: { select: { username: true } } },
    }),
    prisma.report.findMany({
      where: { reporterId: userId },
      select: { targetType: true, reason: true, status: true, createdAt: true },
    }),
    prisma.pushSubscription.findMany({
      where: { userId },
      select: { endpoint: true, userAgent: true, createdAt: true },
    }),
    prisma.userQuest.findMany({
      where: { userId },
      select: { title: true, progress: true, target: true, assignedDate: true, completedAt: true },
    }),
    prisma.userCollectible.findMany({
      where: { userId },
      select: { earnedAt: true, collectible: { select: { name: true } } },
    }),
  ])

  const files = buildExportFiles(
    {
      user, notificationPreferences, reviews, comments, reviewLikes, favorites,
      bites, photos, badges, userStats, xpEvents, notifications, following,
      followers, reports, pushSubscriptions, userQuests, userCollectibles,
    },
    new Date(),
  )

  for (const [name, value] of Object.entries(files)) {
    archive.append(JSON.stringify(value, null, 2), { name: `data/${name}` })
  }

  // Uploaded photos: original files under photos/<photoId>.<ext>. A missing
  // object (e.g. already swept) is skipped, never fatal.
  for (const photo of photos) {
    try {
      const stream = await minioClient.getObject(BUCKET, photo.storageKey)
      const ext = photo.storageKey.split('.').pop() ?? 'bin'
      archive.append(stream, { name: `photos/${photo.id}.${ext}` })
    } catch {
      logger.warn({ photoId: photo.id }, 'Export: skipped missing photo object')
    }
  }

  if (user.avatarKey) {
    try {
      const stream = await minioClient.getObject(BUCKET, user.avatarKey)
      const ext = user.avatarKey.split('.').pop() ?? 'bin'
      archive.append(stream, { name: `avatar.${ext}` })
    } catch {
      logger.warn({ userId }, 'Export: skipped missing avatar object')
    }
  }

  await archive.finalize()

  // Accountability (Art. 5(2)): every export of personal data is recorded.
  await logPrivacyAction(userId, 'DATA_EXPORTED', { photoCount: photos.length })
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  // Generating a full export is expensive and the data changes slowly: twice
  // a day per user is plenty and keeps the endpoint useless for abuse.
  const rl = await rateLimitUser(auth.sub, 'data_export', 2, 86400)
  if (!rl.allowed) return err('Too many requests - you can export your data twice per day', 429)

  try {
    const pass = new PassThrough()
    const archive = archiver('zip', { zlib: { level: 6 } })

    archive.on('error', (e) => pass.destroy(e))
    archive.on('warning', (e) => {
      if (e.code !== 'ENOENT') pass.destroy(e)
    })
    archive.pipe(pass)

    // Build asynchronously so the response starts streaming immediately.
    buildUserExport(auth.sub, archive).catch((e) => {
      logger.error({ err: e, userId: auth.sub }, 'User data export failed')
      pass.destroy(e instanceof Error ? e : new Error(String(e)))
    })

    return new Response(Readable.toWeb(pass) as ReadableStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="snackspot-my-data-${new Date().toISOString().slice(0, 10)}.zip"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return serverError('me/export', e)
  }
}
