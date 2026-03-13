import { prisma } from './db'
import { logger } from './logger'

const BLOCKED_WORDS_TTL_MS = 30 * 1000

let cache:
  | {
      expiresAt: number
      words: string[]
    }
  | null = null

export async function getBlockedWords(): Promise<string[]> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.words
  }

  try {
    const rows = await prisma.blockedWord.findMany({
      select: { word: true },
      orderBy: { word: 'asc' },
    })
    const words = rows.map((row) => row.word)
    cache = {
      words,
      expiresAt: Date.now() + BLOCKED_WORDS_TTL_MS,
    }
    return words
  } catch (err) {
    logger.error({ err }, 'failed to load blocked words')
    return cache?.words ?? []
  }
}
