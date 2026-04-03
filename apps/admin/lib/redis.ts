import Redis from 'ioredis'
import { env } from './env'

const globalForRedis = globalThis as unknown as { redis: Redis }

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis
}
