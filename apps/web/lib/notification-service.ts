import { prisma } from './db'
import { logger } from './logger'
import { getSiteUrl } from './site-url'
import {
  sendNotificationLikeEmail,
  sendNotificationCommentEmail,
  sendNotificationMentionEmail,
  sendNotificationBadgeEmail,
} from './email'

type NotificationType = 'REVIEW_LIKE' | 'REVIEW_COMMENT' | 'REVIEW_MENTION' | 'COMMENT_MENTION' | 'BADGE_EARNED'

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string
  actorId?: string
  reviewId?: string
  commentId?: string
  // Extra context for email sending — not stored in DB
  actorName?: string
  dishName?: string | null
  placeName?: string | null
  badgeName?: string
}

export async function createNotification(params: CreateNotificationParams): Promise<Awaited<ReturnType<typeof prisma.notification.create>> | null> {
  try {
    // Don't notify users about their own actions
    if (params.userId === params.actorId) {
      logger.debug({ params }, 'Skipping notification: actor is same as recipient')
      return null
    }

    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
        actorId: params.actorId,
        reviewId: params.reviewId,
        commentId: params.commentId,
      },
    })
    logger.debug({ notificationId: notification.id, userId: params.userId }, 'Notification created successfully')

    // Fire-and-forget email — never block or throw on failure
    void sendEmailForNotification(params).catch((err) =>
      logger.error({ err, userId: params.userId, type: params.type }, 'Failed to send notification email'),
    )

    return notification
  } catch (err) {
    logger.error({ err, params }, 'Failed to create notification')
    return null
  }
}

async function sendEmailForNotification(params: CreateNotificationParams): Promise<void> {
  const recipient = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      email: true,
      username: true,
      notificationPreferences: true,
    },
  })

  if (!recipient) return

  const prefs = recipient.notificationPreferences
  const appUrl = getSiteUrl()
  const reviewUrl = params.link ? `${appUrl}${params.link}` : `${appUrl}/`
  const profileUrl = `${appUrl}/profile`

  switch (params.type) {
    case 'REVIEW_LIKE':
      if (prefs?.emailOnLike) {
        await sendNotificationLikeEmail(
          recipient.email,
          recipient.username,
          params.actorName ?? 'Someone',
          params.dishName ?? null,
          reviewUrl,
        )
      }
      break
    case 'REVIEW_COMMENT':
      if (prefs?.emailOnComment) {
        await sendNotificationCommentEmail(
          recipient.email,
          recipient.username,
          params.actorName ?? 'Someone',
          params.dishName ?? null,
          reviewUrl,
        )
      }
      break
    case 'REVIEW_MENTION':
    case 'COMMENT_MENTION':
      if (prefs?.emailOnMention) {
        await sendNotificationMentionEmail(
          recipient.email,
          recipient.username,
          params.actorName ?? 'Someone',
          params.placeName ?? null,
          reviewUrl,
        )
      }
      break
    case 'BADGE_EARNED':
      if (prefs?.emailOnBadge) {
        await sendNotificationBadgeEmail(
          recipient.email,
          recipient.username,
          params.badgeName ?? 'New badge',
          profileUrl,
        )
      }
      break
  }
}

// ─── Shared lookup helpers ──────────────────────────────────────────────────

async function findReviewOwnerForNotification(reviewId: string, context: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { userId: true, dishName: true },
  })
  if (!review) logger.warn({ reviewId }, `Review not found for ${context} notification`)
  return review
}

async function findReviewPlaceForNotification(reviewId: string, context: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { place: { select: { name: true } } },
  })
  if (!review) logger.warn({ reviewId }, `Review not found for ${context} notification`)
  return review
}

async function findActorUsername(actorId: string): Promise<string | null> {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { username: true },
  })
  return actor?.username ?? null
}

/** Wraps a notification builder so errors are logged but never thrown. */
async function safeNotify(
  context: string,
  ids: Record<string, string>,
  fn: () => ReturnType<typeof createNotification>,
) {
  try {
    return await fn()
  } catch (err) {
    logger.error({ err, ...ids }, `Failed to notify ${context}`)
    return null
  }
}

// ─── Public notification functions ──────────────────────────────────────────

export function notifyReviewLike(reviewId: string, actorId: string) {
  return safeNotify('review like', { reviewId, actorId }, async () => {
    const review = await findReviewOwnerForNotification(reviewId, 'like')
    if (!review) return null

    const actorName = await findActorUsername(actorId)
    if (!actorName) return null

    return createNotification({
      userId: review.userId,
      type: 'REVIEW_LIKE',
      title: 'New like',
      message: `${actorName} liked your review${review.dishName ? ` of ${review.dishName}` : ''}`,
      link: `/review/${reviewId}`,
      actorId,
      reviewId,
      actorName,
      dishName: review.dishName,
    })
  })
}

export function notifyReviewComment(reviewId: string, commentId: string, actorId: string) {
  return safeNotify('review comment', { reviewId, commentId, actorId }, async () => {
    const review = await findReviewOwnerForNotification(reviewId, 'comment')
    if (!review) return null

    const actorName = await findActorUsername(actorId)
    if (!actorName) return null

    return createNotification({
      userId: review.userId,
      type: 'REVIEW_COMMENT',
      title: 'New comment',
      message: `${actorName} commented on your review${review.dishName ? ` of ${review.dishName}` : ''}`,
      link: `/review/${reviewId}`,
      actorId,
      reviewId,
      commentId,
      actorName,
      dishName: review.dishName,
    })
  })
}

export function notifyMention(mentionedUserId: string, reviewId: string, actorId: string) {
  return safeNotify('mention', { mentionedUserId, reviewId, actorId }, async () => {
    const review = await findReviewPlaceForNotification(reviewId, 'mention')
    if (!review) return null

    const actorName = await findActorUsername(actorId)
    if (!actorName) return null

    return createNotification({
      userId: mentionedUserId,
      type: 'REVIEW_MENTION',
      title: 'You were mentioned',
      message: `${actorName} mentioned you in a review${review.place ? ` at ${review.place.name}` : ''}`,
      link: `/review/${reviewId}`,
      actorId,
      reviewId,
      actorName,
      placeName: review.place?.name ?? null,
    })
  })
}

export function notifyCommentMention(
  mentionedUserId: string,
  reviewId: string,
  commentId: string,
  actorId: string,
) {
  return safeNotify('comment mention', { mentionedUserId, reviewId, commentId, actorId }, async () => {
    const review = await findReviewPlaceForNotification(reviewId, 'comment mention')
    if (!review) return null

    const actorName = await findActorUsername(actorId)
    if (!actorName) return null

    return createNotification({
      userId: mentionedUserId,
      type: 'COMMENT_MENTION',
      title: 'You were mentioned',
      message: `${actorName} mentioned you in a comment${review.place ? ` at ${review.place.name}` : ''}`,
      link: `/review/${reviewId}`,
      actorId,
      reviewId,
      commentId,
      actorName,
      placeName: review.place?.name ?? null,
    })
  })
}

export function notifyBadgeEarned(userId: string, badgeName: string) {
  return safeNotify('badge earned', { userId, badgeName }, () =>
    createNotification({
      userId,
      type: 'BADGE_EARNED',
      title: 'Achievement unlocked',
      message: `You unlocked "${badgeName}"`,
      link: '/profile',
      badgeName,
    }),
  )
}
