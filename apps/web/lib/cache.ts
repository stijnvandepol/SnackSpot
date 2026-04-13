import { redis } from './redis'
import { logger } from './logger'

const CACHE_PREFIX = 'cache:v1:'

// Produces a deterministic string from search params so that
// ?tag=X&limit=4 and ?limit=4&tag=X resolve to the same cache key.
export function stableSearchParams(params: URLSearchParams): string {
  return [...params.entries()]
    .sort(([aKey, aVal], [bKey, bVal]) => {
      const byKey = aKey.localeCompare(bKey)
      return byKey !== 0 ? byKey : aVal.localeCompare(bVal)
    })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

export function buildCacheKey(namespace: string, suffix: string): string {
  return `${CACHE_PREFIX}${namespace}:${suffix}`
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch (err) {
    logger.warn({ err, key }, 'cache read failed')
    return null
  }
}

export async function setCachedJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } catch (err) {
    logger.warn({ err, key }, 'cache write failed')
  }
}
