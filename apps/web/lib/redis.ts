import Redis from 'ioredis'
import { env } from './env'
import { logger } from './logger'

const globalForRedis = globalThis as unknown as { redis: Redis }

// Under test the client must not dial on import.
//
// The client is constructed at module load, so importing anything that transitively
// reaches this file opens a socket to 127.0.0.1:6379 — and during a unit test run there is
// nothing listening. The `error` handler below turned each attempt into a log line, which
// buried real failures under ECONNREFUSED noise on every run.
//
// lazyConnect defers the socket to the first command. Tests that exercise Redis mock this
// module, and the cache helpers already treat a failed call as a miss, so nothing else
// changes. Production and development keep connecting eagerly.
const isTest = process.env.NODE_ENV === 'test'

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: isTest,
  })

redis.on('error', (err) => logger.error({ err }, 'Redis error'))
redis.on('connect', () => logger.info('Redis connected'))

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis
}

export default redis
