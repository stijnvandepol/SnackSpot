import pino from 'pino'
import { env } from './env'

export const logger = pino({
  level: env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'debug'),
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
