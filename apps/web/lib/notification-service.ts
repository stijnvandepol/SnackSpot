import { prisma } from './db'
import { logger } from './logger'
import { getSiteUrl } from './site-url'
import {
  sendNotificationLikeEmail,
  sendNotificationCommentEmail,
  sendNotificationMentionEmail,
  sendNotificationBadgeEmail,
  sendNotificationFollowEmail,
} from './email'
import { enqueuePush, type PushCategory } from './push-service'

type NotificationType = 'REVIEW_LIKE' | 'REVIEW_COMMENT' | 'REVIEW_MENTION' | 'COMMENT_MENTION' | 'BADGE_EARNED' | 'NEW_FOLLOWER'

const PUSH_CATEGORY_BY_TYPE: Record<NotificationType, PushCategory> = {
  REVIEW_LIKE: 'LIKE',
  REVIEW_COMMENT: 'COMMENT',
  REVIEW_MENTION: 'MENTION',
  COMMENT_MENTION: 'MENTION',
  BADGE_EARNED: 'BADGE',
  NEW_FOLLOWER: 'FOLLOW',
}

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

    // Fire-and-forget web push — the worker checks preferences/subscriptions.
    void enqueuePush({
      userId: params.userId,
      category: PUSH_CATEGORY_BY_TYPE[params.type],
      title: params.title,
      message: params.message,
      url: params.link ?? '/',
    })

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
          params.actorName ?? 'Iemand',
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
          params.actorName ?? 'Iemand',
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
          params.actorName ?? 'Iemand',
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
          params.badgeName ?? 'Nieuwe badge',
          profileUrl,
        )
      }
      break
    case 'NEW_FOLLOWER':
      if (prefs?.emailOnFollow) {
        await sendNotificationFollowEmail(
          recipient.email,
          recipient.username,
          params.actorName ?? 'Iemand',
          // Link points at the new follower's profile (params.link is /u/<follower>).
          params.link ? `${appUrl}${params.link}` : `${appUrl}/`,
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
    const [review, actorName] = await Promise.all([
      findReviewOwnerForNotification(reviewId, 'like'),
      findActorUsername(actorId),
    ])
    if (!review || !actorName) return null

    return createNotification({
      userId: review.userId,
      type: 'REVIEW_LIKE',
      title: 'Nieuwe like',
      message: `${actorName} vindt je review${review.dishName ? ` over ${review.dishName}` : ''} leuk`,
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
    const [review, actorName] = await Promise.all([
      findReviewOwnerForNotification(reviewId, 'comment'),
      findActorUsername(actorId),
    ])
    if (!review || !actorName) return null

    return createNotification({
      userId: review.userId,
      type: 'REVIEW_COMMENT',
      title: 'Nieuwe reactie',
      message: `${actorName} reageerde op je review${review.dishName ? ` over ${review.dishName}` : ''}`,
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
    const [review, actorName] = await Promise.all([
      findReviewPlaceForNotification(reviewId, 'mention'),
      findActorUsername(actorId),
    ])
    if (!review || !actorName) return null

    return createNotification({
      userId: mentionedUserId,
      type: 'REVIEW_MENTION',
      title: 'Je bent genoemd',
      message: `${actorName} noemde je in een review${review.place ? ` over ${review.place.name}` : ''}`,
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
    const [review, actorName] = await Promise.all([
      findReviewPlaceForNotification(reviewId, 'comment mention'),
      findActorUsername(actorId),
    ])
    if (!review || !actorName) return null

    return createNotification({
      userId: mentionedUserId,
      type: 'COMMENT_MENTION',
      title: 'Je bent genoemd',
      message: `${actorName} noemde je in een reactie${review.place ? ` bij een review over ${review.place.name}` : ''}`,
      link: `/review/${reviewId}`,
      actorId,
      reviewId,
      commentId,
      actorName,
      placeName: review.place?.name ?? null,
    })
  })
}

export function notifyNewFollower(followeeId: string, followerUserId: string) {
  return safeNotify('new follower', { followeeId, followerUserId }, async () => {
    const followerName = await findActorUsername(followerUserId)
    if (!followerName) return null

    return createNotification({
      userId: followeeId,
      type: 'NEW_FOLLOWER',
      title: 'Nieuwe volger',
      message: `${followerName} volgt je nu`,
      link: `/u/${followerName}`,
      actorId: followerUserId,
      actorName: followerName,
    })
  })
}

export function notifyBadgeEarned(userId: string, badgeName: string) {
  return safeNotify('badge earned', { userId, badgeName }, () =>
    createNotification({
      userId,
      type: 'BADGE_EARNED',
      title: 'Nieuwe badge',
      message: `Je hebt de badge "${badgeName}" verdiend`,
      link: '/profile',
      badgeName,
    }),
  )
}
