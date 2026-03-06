import { prisma } from './db'
import { logger } from './logger'

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
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    // Don't notify users about their own actions
    if (params.userId === params.actorId) {
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

    // Check user preferences and send push notification if enabled
    const preferences = await prisma.notificationPreferences.findUnique({
      where: { userId: params.userId },
    })

    if (preferences && shouldSendPush(params.type, preferences)) {
      await sendPushNotification(params.userId, notification)
    }

    return notification
  } catch (error) {
    logger.error({ error, params }, 'Failed to create notification')
    return null
  }
}

function shouldSendPush(
  type: NotificationType,
  preferences: { pushOnLike: boolean; pushOnComment: boolean; pushOnMention: boolean; pushOnBadge: boolean }
): boolean {
  switch (type) {
    case 'REVIEW_LIKE':
      return preferences.pushOnLike
    case 'REVIEW_COMMENT':
      return preferences.pushOnComment
    case 'REVIEW_MENTION':
    case 'COMMENT_MENTION':
      return preferences.pushOnMention
    case 'BADGE_EARNED':
      return preferences.pushOnBadge
    default:
      return false
  }
}

async function sendPushNotification(userId: string, notification: { title: string; message: string; link: string | null }) {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    })

    if (subscriptions.length === 0) {
      return
    }

    // We'll implement web-push in a moment
    // For now, just log that we would send a push
    logger.info({ userId, subscriptions: subscriptions.length }, 'Would send push notification')
  } catch (error) {
    logger.error({ error, userId }, 'Failed to send push notification')
  }
}

export async function notifyReviewLike(reviewId: string, actorId: string) {
  try {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        userId: true,
        dishName: true,
        user: { select: { username: true } },
      },
    })

    if (!review) return null

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { username: true },
    })

    if (!actor) return null

    return createNotification({
      userId: review.userId,
      type: 'REVIEW_LIKE',
      title: 'New like',
      message: `${actor.username} liked your review${review.dishName ? ` of ${review.dishName}` : ''}`,
      link: `/review/${reviewId}`,
      actorId,
      reviewId,
    })
  } catch (error) {
    logger.error({ error, reviewId, actorId }, 'Failed to notify review like')
    return null
  }
}

export async function notifyReviewComment(reviewId: string, commentId: string, actorId: string) {
  try {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        userId: true,
        dishName: true,
        user: { select: { username: true } },
      },
    })

    if (!review) return null

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { username: true },
    })

    if (!actor) return null

    return createNotification({
      userId: review.userId,
      type: 'REVIEW_COMMENT',
      title: 'New comment',
      message: `${actor.username} commented on your review${review.dishName ? ` of ${review.dishName}` : ''}`,
      link: `/review/${reviewId}`,
      actorId,
      reviewId,
      commentId,
    })
  } catch (error) {
    logger.error({ error, reviewId, commentId, actorId }, 'Failed to notify review comment')
    return null
  }
}

export async function notifyMention(mentionedUserId: string, reviewId: string, actorId: string) {
  try {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        dishName: true,
        place: { select: { name: true } },
      },
    })

    if (!review) return null

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { username: true },
    })

    if (!actor) return null

    return createNotification({
      userId: mentionedUserId,
      type: 'REVIEW_MENTION',
      title: 'You were mentioned',
      message: `${actor.username} mentioned you in a review${review.place ? ` at ${review.place.name}` : ''}`,
      link: `/review/${reviewId}`,
      actorId,
      reviewId,
    })
  } catch (error) {
    logger.error({ error, mentionedUserId, reviewId, actorId }, 'Failed to notify mention')
    return null
  }
}

export async function notifyBadgeEarned(userId: string, badgeName: string) {
  try {
    return createNotification({
      userId,
      type: 'BADGE_EARNED',
      title: 'Badge earned!',
      message: `Congratulations! You earned the "${badgeName}" badge`,
      link: '/profile',
    })
  } catch (error) {
    logger.error({ error, userId, badgeName }, 'Failed to notify badge earned')
    return null
  }
}
