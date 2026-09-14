import type { Locale } from './types'

// Client-safe i18n primitives: pure constants + functions with NO `next/headers`
// import, so Client Components (e.g. the language switcher) can import these
// without dragging server-only code into the client bundle. The server-only
// resolveLocale()/getMarketingDict() live in ./locale, which re-exports these.

export type { Locale }

export const LOCALES = ['en', 'nl'] as const
export const DEFAULT_LOCALE: Locale = 'nl'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

export function isLocale(v: string | undefined | null): v is Locale {
  return v === 'en' || v === 'nl'
}

/**
 * Pure: an explicit cookie wins, otherwise the default locale.
 *
 * Accept-Language is deliberately NOT consulted. /product and /product/releases serve both
 * languages from one URL, so negotiating on a request header meant the same URL returned
 * Dutch or English depending on who asked — with no per-locale URL and no hreflang to
 * explain it. Googlebot crawls with an en-US Accept-Language, so it only ever saw the
 * English copy and the Dutch marketing page was effectively unindexable.
 *
 * Keying on the cookie alone fixes that without splitting the routes: a crawler carries no
 * cookies, so it consistently gets DEFAULT_LOCALE, while a visitor who picks a language in
 * the switcher (components/language-switcher.tsx) keeps their choice.
 */
export function pickLocale(cookieValue: string | undefined): Locale {
  if (isLocale(cookieValue)) return cookieValue
  return DEFAULT_LOCALE
}

// Open Graph locale tag for the active locale (og:locale expects xx_XX).
export function ogLocale(locale: Locale): string {
  return locale === 'nl' ? 'nl_NL' : 'en_US'
}
