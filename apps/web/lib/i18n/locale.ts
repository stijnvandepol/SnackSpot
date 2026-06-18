import { cookies, headers } from 'next/headers'
import type { Locale, MarketingDict } from './types'
import { en } from './marketing/en'
import { nl } from './marketing/nl'
import { LOCALE_COOKIE, pickLocale } from './config'

// Re-export the client-safe primitives so existing server-side imports from
// '@/lib/i18n/locale' keep working. Client Components must import those from
// './config' directly (this module pulls in next/headers).
export * from './config'

const DICTS: Record<Locale, MarketingDict> = { en, nl }

// Server-only: reads the request cookie/headers to resolve the active locale.
export async function resolveLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()])
  return pickLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headerList.get('accept-language') ?? undefined,
  )
}

export function getMarketingDict(locale: Locale): MarketingDict {
  return DICTS[locale]
}
