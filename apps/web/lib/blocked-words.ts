import { prisma } from './db'
import { logger } from './logger'

const BLOCKED_WORDS_TTL_MS = 30 * 1000

interface BlockedWordsCache {
  expiresAt: number
  words: string[]
  regexes: RegExp[]
}

let cache: BlockedWordsCache | null = null
// In-flight promise prevents concurrent cache-miss requests from all hitting the DB.
let _inflight: Promise<BlockedWordsCache> | null = null

export function filterText(text: string, regexes: RegExp[]): string {
  let result = text
  for (const re of regexes) {
    result = result.replace(re, '**')
  }
  return result
}

export async function getBlockedWords(): Promise<string[]> {
  const entry = await _getCache()
  return entry.words
}

export async function getBlockedWordsCache(): Promise<BlockedWordsCache> {
  return _getCache()
}

async function _getCache(): Promise<BlockedWordsCache> {
  if (cache && cache.expiresAt > Date.now()) return cache

  if (!_inflight) {
    _inflight = _fetchFromDb().finally(() => { _inflight = null })
  }
  return _inflight
}

async function _fetchFromDb(): Promise<BlockedWordsCache> {
  try {
    const rows = await prisma.blockedWord.findMany({
      select: { word: true },
      orderBy: { word: 'asc' },
    })
    const words = rows.map((row) => row.word)
    const regexes = words.map((w) => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'))
    const entry: BlockedWordsCache = { words, regexes, expiresAt: Date.now() + BLOCKED_WORDS_TTL_MS }
    cache = entry
    return entry
  } catch (err) {
    logger.error({ err }, 'failed to load blocked words')
    if (cache) return cache
    return { words: [], regexes: [], expiresAt: 0 }
  }
}
