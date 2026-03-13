import { prisma } from './db'
import { logger } from './logger'

const BLOCKED_WORDS_TTL_MS = 30 * 1000

let cache:
  | {
      expiresAt: number
      words: string[]
    }
  | null = null

export function filterText(text: string, blockedWords: string[]): string {
  let result = text
  for (const word of blockedWords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(escaped, 'gi'), '**')
  }
  return result
}

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
