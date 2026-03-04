import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
          ]
        : [{ emit: 'event', level: 'error' }],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  // @ts-expect-error – Prisma event type
  prisma.$on('query', (e: { query: string; duration: number }) => {
    logger.debug({ query: e.query, duration: e.duration }, 'db query')
  })
}

// @ts-expect-error – Prisma event type
prisma.$on('error', (e: { message: string }) => {
  logger.error({ err: e.message }, 'db error')
})
