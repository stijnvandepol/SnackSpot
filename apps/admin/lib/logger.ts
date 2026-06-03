import pino from 'pino'
import { env } from './env'

// Mirrors apps/web/lib/logger.ts so admin logs share the same structure and
// secret-redaction policy. The admin env schema has no LOG_LEVEL override, so
// the level is derived from NODE_ENV only.
export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'headers.authorization',
      'headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.access_token',
      '*.refresh_token',
      '*.jwt',
    ],
    remove: true,
  },
  ...(env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard' },
    },
  }),
})
