import { cookies, headers } from 'next/headers'
import type { Locale, MarketingDict } from './types'
import { en } from './marketing/en'
import { nl } from './marketing/nl'

export type { Locale }

export const LOCALES = ['en', 'nl'] as const
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

const DICTS: Record<Locale, MarketingDict> = { en, nl }

export function isLocale(v: string | undefined | null): v is Locale {
  return v === 'en' || v === 'nl'
}

// Pure: cookie wins, else first Accept-Language tag whose base matches a locale,
// else the default. Kept pure so it is unit-testable without next/headers.
export function pickLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | undefined,
): Locale {
  if (isLocale(cookieValue)) return cookieValue
  if (acceptLanguage) {
    for (const part of acceptLanguage.split(',')) {
      const base = part.trim().split(';')[0].toLowerCase().split('-')[0]
      if (isLocale(base)) return base
    }
  }
  return DEFAULT_LOCALE
}

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
