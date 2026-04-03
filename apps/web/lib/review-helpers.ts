import type { Prisma } from '@prisma/client'
import { ReviewStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { err } from '@/lib/api-helpers'
import type { AccessTokenPayload } from '@/lib/auth'
import { logger } from '@/lib/logger'

// ─── Shared Prisma select for review list items ─────────────────────────────

/** Builds the Prisma `select` clause used by every review-list endpoint.
 *  Pass the authenticated user's ID (or undefined) so the `reviewLikes`
 *  sub-query checks the correct user. */
export function reviewListSelect(authUserId?: string) {
  return {
    id: true,
    rating: true,
    ratingTaste: true,
    ratingValue: true,
    ratingPortion: true,
    ratingService: true,
    ratingOverall: true,
    text: true,
    dishName: true,
    status: true,
    createdAt: true,
    tags: {
      orderBy: { tag: 'asc' as const },
      select: { tag: true },
    },
    user: { select: { id: true, username: true, avatarKey: true, role: true, isVerified: true } },
    place: { select: { id: true, name: true, address: true } },
    _count: { select: { reviewLikes: true, comments: true } },
    reviewLikes: {
      where: { userId: authUserId ?? '__no_user__' },
      select: { userId: true },
      take: 1,
    },
    reviewPhotos: {
      take: 5,
      orderBy: { sortOrder: 'asc' as const },
      select: {
        photo: { select: { id: true, variants: true } },
      },
    },
  } satisfies Prisma.ReviewSelect
}

// ─── Review serialization ───────────────────────────────────────────────────

/** Raw review shape returned by Prisma when using `reviewListSelect`. */
interface RawReviewListItem {
  rating: Prisma.Decimal | number
  ratingTaste: Prisma.Decimal | number
  ratingValue: Prisma.Decimal | number
  ratingPortion: Prisma.Decimal | number
  ratingService: Prisma.Decimal | number | null
  ratingOverall: Prisma.Decimal | number
  tags: Array<{ tag: string }>
  _count: { reviewLikes: number; comments?: number }
  reviewLikes: Array<{ userId: string }>
  [key: string]: unknown
}

/** Converts a raw Prisma review into the API response shape:
 *  - Decimal fields → plain numbers
 *  - Flattens tags array
 *  - Adds likeCount, commentCount, likedByMe
 *  - Removes internal _count and reviewLikes fields */
export function serializeReview(item: RawReviewListItem) {
  return {
    ...item,
    rating: Number(item.rating),
    likeCount: item._count.reviewLikes,
    commentCount: item._count.comments ?? 0,
    likedByMe: item.reviewLikes.length > 0,
    ratings: {
      taste: Number(item.ratingTaste),
      value: Number(item.ratingValue),
      portion: Number(item.ratingPortion),
      service: item.ratingService === null ? null : Number(item.ratingService),
    },
    overallRating: Number(item.ratingOverall),
    tags: item.tags.map((t) => t.tag),
    _count: undefined,
    reviewLikes: undefined,
  }
}

// ─── Review visibility check ────────────────────────────────────────────────

/** Returns an error Response if the review is not visible to the current user,
 *  or null if access is allowed. */
export function checkReviewVisibility(
  review: { status: ReviewStatus; userId: string },
  auth: AccessTokenPayload | null,
): Response | null {
  if (review.status === ReviewStatus.DELETED) return err('Review not found', 404)
  if (review.status === ReviewStatus.HIDDEN) {
    const isOwner = auth?.sub === review.userId
    const isMod = auth?.role === 'MODERATOR' || auth?.role === 'ADMIN'
    if (!isOwner && !isMod) return err('Review not found', 404)
  }
  return null
}

// ─── Photo validation ───────────────────────────────────────────────────────

/** Validates that the given photo IDs belong to the user, are confirmed
 *  (not PENDING), and are not already attached to another review.
 *  Returns an error Response or null if all photos are valid.
 *  Pass `currentReviewId` when editing an existing review so photos already
 *  attached to *that* review are not rejected. */
export async function validatePhotos(
  photoIds: string[],
  uploaderId: string,
  currentReviewId?: string,
): Promise<Response | null> {
  const photos = await prisma.photo.findMany({
    where: { id: { in: photoIds }, uploaderId },
    select: {
      id: true,
      moderationStatus: true,
      reviewPhotos: { select: { reviewId: true }, take: 1 },
    },
  })

  if (photos.length !== photoIds.length) {
    return err('One or more photo IDs are invalid', 422)
  }

  const pending = photos.filter((p) => p.moderationStatus === 'PENDING')
  if (pending.length > 0) {
    return err('One or more photos are not uploaded yet - please wait for upload confirmation', 409)
  }

  const attachedElsewhere = photos.filter(
    (p) => p.reviewPhotos.length > 0 && p.reviewPhotos[0].reviewId !== currentReviewId,
  )
  if (attachedElsewhere.length > 0) {
    return err(
      currentReviewId
        ? 'One or more photos are already attached to another review'
        : 'One or more photos are already attached to a review',
      409,
    )
  }

  return null
}

// ─── Mention extraction ─────────────────────────────────────────────────────

const MENTION_REGEX = /@(\w{3,30})/g
const MAX_MENTIONS = 10

/** Extracts unique lowercase usernames from @mentions in text. */
export function extractMentionedUsernames(text: string): string[] {
  const matches = text.match(MENTION_REGEX) ?? []
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))].slice(0, MAX_MENTIONS)
}

/** Resolves mentioned usernames to user IDs, excluding banned users.
 *  Merges with any explicitly provided user IDs and filters out `excludeUserId`.
 *  Uses a single DB query by combining username lookup and ID validation. */
export async function resolveMentionedUserIds(
  usernames: string[],
  explicitUserIds: string[],
  excludeUserId: string,
): Promise<string[]> {
  const cappedUsernames = usernames.slice(0, MAX_MENTIONS)
  const cappedExplicitIds = explicitUserIds.slice(0, MAX_MENTIONS)

  if (cappedUsernames.length === 0 && cappedExplicitIds.length === 0) return []

  const users = await prisma.user.findMany({
    where: {
      bannedAt: null,
      OR: [
        ...(cappedUsernames.length > 0
          ? cappedUsernames.map((username) => ({
              username: { equals: username, mode: 'insensitive' as const },
            }))
          : []),
        ...(cappedExplicitIds.length > 0 ? [{ id: { in: cappedExplicitIds } }] : []),
      ],
    },
    select: { id: true },
  })

  return [...new Set(users.map((u) => u.id))].filter((id) => id !== excludeUserId)
}

/** Full mention processing: extract usernames, resolve IDs, create ReviewMention
 *  records, and send notifications. Errors are logged but do not throw. */
export async function processMentions(
  text: string,
  reviewId: string,
  actorId: string,
  explicitMentionIds: string[],
  notifyFn: (userId: string, reviewId: string, actorId: string) => Promise<unknown>,
): Promise<void> {
  try {
    const usernames = extractMentionedUsernames(text)
    const userIds = await resolveMentionedUserIds(usernames, explicitMentionIds, actorId)

    if (userIds.length === 0) return

    await prisma.reviewMention.createMany({
      data: userIds.map((userId) => ({
        reviewId,
        mentionedUserId: userId,
        mentionedByUserId: actorId,
      })),
      skipDuplicates: true,
    })

    await Promise.allSettled(userIds.map((userId) => notifyFn(userId, reviewId, actorId)))
  } catch (error) {
    logger.error({ err: error, reviewId, actorId }, 'Mention processing failed')
  }
}
