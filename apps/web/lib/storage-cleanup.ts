import { minioClient, BUCKET } from './minio'
import { logger } from './logger'

export { photoObjectKeys, avatarObjectKeys } from './storage-keys'

/**
 * Remove objects from MinIO, tolerating individual failures: a missing object
 * or a storage hiccup must never fail the surrounding user request. Anything
 * that survives is picked up by the worker's daily unused-image sweep.
 */
export async function removeObjectsBestEffort(keys: string[], context: string): Promise<void> {
  const results = await Promise.allSettled(
    keys.map((key) => minioClient.removeObject(BUCKET, key)),
  )
  const failed = results.filter((r) => r.status === 'rejected').length
  if (failed > 0) {
    logger.warn({ context, failed, total: keys.length }, 'Some MinIO objects could not be removed; daily sweep will retry')
  }
}
