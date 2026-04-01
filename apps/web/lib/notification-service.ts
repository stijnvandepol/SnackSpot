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

/** HTTP status codes indicating a push subscription has been revoked. */
const EXPIRED_SUBSCRIPTION_STATUSES = new Set([404, 410])

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

    try {
      const preferences = await prisma.notificationPreferences.findUnique({
        where: { userId: params.userId },
      })

      if (preferences && shouldSendPush(params.type, preferences)) {
        await sendPushNotification(params.userId, notification)
      }
    } catch (prefError) {
      logger.error({ err: prefError, userId: params.userId }, 'Failed to check notification preferences')
      // Continue anyway - notification was created successfully
    }

    return notification
  } catch (err) {
    logger.error({ err, params }, 'Failed to create notification')
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
  } catch (err) {
    logger.error({ err, userId }, 'Failed to fetch push subscriptions')
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
        const status = (err as { statusCode?: number }).statusCode ?? 0
        if (EXPIRED_SUBSCRIPTION_STATUSES.has(status)) {
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

// ─── Shared lookup helpers ──────────────────────────────────────────────────

async function findReviewForNotification(
  reviewId: string,
  select: Record<string, unknown>,
  context: string,
) {
  const review = await prisma.review.findUnique({ where: { id: reviewId }, select })
  if (!review) {
    logger.warn({ reviewId }, `Review not found for ${context} notification`)
  }
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
    const review = await findReviewForNotification(
      reviewId,
      { userId: true, dishName: true },
      'like',
    ) as { userId: string; dishName: string | null } | null
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
    })
  })
}

export function notifyReviewComment(reviewId: string, commentId: string, actorId: string) {
  return safeNotify('review comment', { reviewId, commentId, actorId }, async () => {
    const review = await findReviewForNotification(
      reviewId,
      { userId: true, dishName: true },
      'comment',
    ) as { userId: string; dishName: string | null } | null
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
    })
  })
}

export function notifyMention(mentionedUserId: string, reviewId: string, actorId: string) {
  return safeNotify('mention', { mentionedUserId, reviewId, actorId }, async () => {
    const review = await findReviewForNotification(
      reviewId,
      { place: { select: { name: true } } },
      'mention',
    ) as { place: { name: string } | null } | null
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
    const review = await findReviewForNotification(
      reviewId,
      { place: { select: { name: true } } },
      'comment mention',
    ) as { place: { name: string } | null } | null
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
    }),
  )
}
