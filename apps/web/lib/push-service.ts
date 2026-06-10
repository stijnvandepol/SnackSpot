import { Queue } from 'bullmq'
import { redis } from './redis'
import { logger } from './logger'

// The web app only *enqueues* push jobs; the worker resolves the recipient's
// preferences and subscriptions and does the actual Web Push delivery.
export const PUSH_QUEUE = 'push-notifications'

export type PushCategory = 'LIKE' | 'COMMENT' | 'MENTION' | 'BADGE' | 'STREAK'

export interface PushJob {
  userId: string
  category: PushCategory
  title: string
  message: string
  /** App-relative URL opened when the notification is clicked. */
  url: string
}

let _queue: Queue | null = null

function getPushQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(PUSH_QUEUE, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    })
  }
  return _queue
}

/** Fire-and-forget: a failed enqueue must never break the triggering action. */
export async function enqueuePush(job: PushJob): Promise<void> {
  try {
    await getPushQueue().add('send-push', job)
  } catch (err) {
    logger.error({ err, userId: job.userId, category: job.category }, 'Failed to enqueue push')
  }
}
