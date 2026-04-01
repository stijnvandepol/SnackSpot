import { redis } from './redis'
import { logger } from './logger'

const CACHE_PREFIX = 'cache:v1:'

export function stableSearchParams(params: URLSearchParams): string {
  return [...params.entries()]
    .sort(([aKey, aValue], [bKey, bValue]) =>
      aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey),
    )
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
