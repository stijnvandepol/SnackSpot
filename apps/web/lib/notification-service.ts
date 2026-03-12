import webPush from 'web-push'
import { prisma } from './db'
import { logger } from './logger'
import { env } from './env'

// Configure VAPID credentials once at module load.
// Push notifications are silently disabled when VAPID keys are absent so the
// app starts cleanly without them (e.g. local dev without a service worker).
// Generate keys with: npx web-push generate-vapid-keys
const PUSH_ENABLED = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT)
if (PUSH_ENABLED) {
  webPush.setVapidDetails(env.VAPID_SUBJECT!, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!)
}

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
      logger.debug({ params }, 'Skipping notification: actor is same as recipient')
      return null
    }

    logger.debug({ params }, 'Creating notification')
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

    // Check user preferences and send push notification if enabled
    try {
      const preferences = await prisma.notificationPreferences.findUnique({
        where: { userId: params.userId },
      })

      if (preferences && shouldSendPush(params.type, preferences)) {
        await sendPushNotification(params.userId, notification)
      }
    } catch (prefError) {
      logger.error({ error: prefError, userId: params.userId }, 'Failed to check notification preferences')
      // Continue anyway - notification was created successfully
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

async function sendPushNotification(
  userId: string,
  notification: { title: string; message: string; link: string | null },
) {
  if (!PUSH_ENABLED) return

  let subscriptions: Array<{ id: string; endpoint: string; p256dhKey: string; authKey: string }>
  try {
    subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dhKey: true, authKey: true },
    })
  } catch (error) {
    logger.error({ error, userId }, 'Failed to fetch push subscriptions')
    return
  }

  if (subscriptions.length === 0) return

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message,
    url: notification.link ?? '/',
  })

  const expiredEndpoints: string[] = []

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dhKey, auth: sub.authKey } },
          payload,
        )
        logger.debug({ userId, endpoint: sub.endpoint }, 'Push notification sent')
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 410 || status === 404) {
          // Subscription has been revoked by the browser — remove it.
          expiredEndpoints.push(sub.endpoint)
          logger.debug({ userId, endpoint: sub.endpoint, status }, 'Removing expired push subscription')
        } else {
          logger.warn({ err, userId, endpoint: sub.endpoint }, 'Push notification delivery failed')
        }
      }
    }),
  )

  if (expiredEndpoints.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { userId, endpoint: { in: expiredEndpoints } } })
      .catch((err) => logger.error({ err, userId }, 'Failed to delete expired push subscriptions'))
  }
}

export async function notifyReviewLike(reviewId: string, actorId: string) {
  try {
    logger.debug({ reviewId, actorId }, 'notifyReviewLike called')
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        userId: true,
        dishName: true,
        user: { select: { username: true } },
      },
    })

    if (!review) {
      logger.warn({ reviewId }, 'Review not found for like notification')
      return null
    }

    if (review.userId === actorId) {
      logger.debug({ reviewId, actorId }, 'Skipping like notification: user liked their own review')
      return null
    }

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
    logger.debug({ reviewId, commentId, actorId }, 'notifyReviewComment called')
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        userId: true,
        dishName: true,
        user: { select: { username: true } },
      },
    })

    if (!review) {
      logger.warn({ reviewId }, 'Review not found for comment notification')
      return null
    }

    if (review.userId === actorId) {
      logger.debug({ reviewId, actorId }, 'Skipping comment notification: user commented on their own review')
      return null
    }

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
    logger.debug({ mentionedUserId, reviewId, actorId }, 'notifyMention called')
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        dishName: true,
        place: { select: { name: true } },
      },
    })

    if (!review) {
      logger.warn({ reviewId }, 'Review not found for mention notification')
      return null
    }

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

export async function notifyCommentMention(
  mentionedUserId: string,
  reviewId: string,
  commentId: string,
  actorId: string,
) {
  try {
    logger.debug({ mentionedUserId, reviewId, commentId, actorId }, 'notifyCommentMention called')
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        place: { select: { name: true } },
      },
    })

    if (!review) {
      logger.warn({ reviewId, commentId }, 'Review not found for comment mention notification')
      return null
    }

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { username: true },
    })

    if (!actor) return null

    return createNotification({
      userId: mentionedUserId,
      type: 'COMMENT_MENTION',
      title: 'You were mentioned',
      message: `${actor.username} mentioned you in a comment${review.place ? ` at ${review.place.name}` : ''}`,
      link: `/review/${reviewId}`,
      actorId,
      reviewId,
      commentId,
    })
  } catch (error) {
    logger.error({ error, mentionedUserId, reviewId, commentId, actorId }, 'Failed to notify comment mention')
    return null
  }
}

export async function notifyBadgeEarned(userId: string, badgeName: string) {
  try {
    return createNotification({
      userId,
      type: 'BADGE_EARNED',
      title: 'Achievement unlocked',
      message: `You unlocked "${badgeName}"`,
      link: '/profile',
    })
  } catch (error) {
    logger.error({ error, userId, badgeName }, 'Failed to notify badge earned')
    return null
  }
}
