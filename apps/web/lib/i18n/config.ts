import type { Locale } from './types'

// Client-safe i18n primitives: pure constants + functions with NO `next/headers`
// import, so Client Components (e.g. the language switcher) can import these
// without dragging server-only code into the client bundle. The server-only
// resolveLocale()/getMarketingDict() live in ./locale, which re-exports these.

export type { Locale }

export const LOCALES = ['en', 'nl'] as const
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

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

// Open Graph locale tag for the active locale (og:locale expects xx_XX).
export function ogLocale(locale: Locale): string {
  return locale === 'nl' ? 'nl_NL' : 'en_US'
}
