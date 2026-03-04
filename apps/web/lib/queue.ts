import { Queue } from 'bullmq'
import { redis } from './redis'

export const PHOTO_QUEUE = 'photo-processing'

export interface PhotoJob {
  photoId: string
  storageKey: string
  uploaderId: string
}

let _queue: Queue | null = null

export function getPhotoQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(PHOTO_QUEUE, {
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
