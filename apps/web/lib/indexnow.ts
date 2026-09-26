import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { getSiteUrl } from '@/lib/site-url'

/**
 * IndexNow: tell search engines a URL changed instead of waiting for their next crawl.
 *
 * One ping reaches every participating engine (Bing, Yandex, Seznam, Naver…), and Bing's
 * index also serves DuckDuckGo, Ecosia, Yahoo and ChatGPT search. Google does not take part;
 * for Google the sitemap's honest <lastmod> is what speeds up recrawling.
 *
 * Off unless INDEXNOW_KEY is set, and never from a non-public origin (localhost, LAN): the
 * engines would verify the key against a host they cannot reach and flag it.
 */
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
export const INDEXNOW_KEY_PATH = '/indexnow-key.txt'
const REQUEST_TIMEOUT_MS = 3000
const MAX_URLS_PER_PING = 10_000

export interface IndexNowPayload {
  host: string
  key: string
  keyLocation: string
  urlList: string[]
}

/** Pure: builds the request body, or null when pinging would be pointless or wrong. */
export function buildIndexNowPayload(
  paths: string[],
  key: string | undefined,
  siteUrl: string,
): IndexNowPayload | null {
  if (!key || paths.length === 0) return null
  let origin: URL
  try {
    origin = new URL(siteUrl)
  } catch {
    return null
  }
  if (origin.protocol !== 'https:' || isPrivateHost(origin.hostname)) return null

  const urlList = Array.from(new Set(paths))
    .filter((path) => path.startsWith('/') && !path.startsWith('//'))
    .slice(0, MAX_URLS_PER_PING)
    .map((path) => `${origin.origin}${path}`)
  if (urlList.length === 0) return null

  return { host: origin.hostname, key, keyLocation: `${origin.origin}${INDEXNOW_KEY_PATH}`, urlList }
}

function isPrivateHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)
  )
}

/**
 * Best-effort ping. Never throws and never waits longer than a few seconds, so callers can
 * fire it without awaiting (`void pingIndexNow([...])`).
 */
export async function pingIndexNow(paths: string[]): Promise<void> {
  const payload = buildIndexNowPayload(paths, env.INDEXNOW_KEY, getSiteUrl())
  if (!payload) return
  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    // 200 = accepted, 202 = accepted pending key check. Anything else is worth a log line.
    if (res.status !== 200 && res.status !== 202) {
      logger.warn({ status: res.status, urls: payload.urlList.length }, 'IndexNow ping rejected')
    }
  } catch (error) {
    logger.warn({ err: error }, 'IndexNow ping failed')
  }
}
