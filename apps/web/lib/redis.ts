import Redis from 'ioredis'
import { env } from './env'
import { logger } from './logger'

const globalForRedis = globalThis as unknown as { redis: Redis }

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  })

redis.on('error', (err) => logger.error({ err }, 'Redis error'))
redis.on('connect', () => logger.info('Redis connected'))

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis
}

export default redis
