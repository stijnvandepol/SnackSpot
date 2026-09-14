import { describe, it, expect } from 'vitest'
import { pickLocale, DEFAULT_LOCALE } from './locale'

describe('pickLocale', () => {
  it('uses a valid cookie', () => {
    expect(pickLocale('nl')).toBe('nl')
    expect(pickLocale('en')).toBe('en')
  })

  it('ignores an invalid cookie', () => {
    expect(pickLocale('de')).toBe(DEFAULT_LOCALE)
  })

  it('falls back to the default when no cookie is set', () => {
    expect(pickLocale(undefined)).toBe(DEFAULT_LOCALE)
  })

  it('defaults to Dutch', () => {
    // The commercial target is the Dutch snackbar niche, and /product serves both
    // languages from one URL. A crawler carries no cookie, so this default decides
    // which language Google indexes for that URL — it must not depend on the request.
    expect(DEFAULT_LOCALE).toBe('nl')
  })

  it('does not negotiate on Accept-Language', () => {
    // Regression guard. Resolving the locale from the request header meant Googlebot
    // (en-US) only ever saw the English copy of the Dutch marketing page, while a
    // Dutch visitor saw something else at the same URL, with no hreflang to explain it.
    expect(pickLocale.length).toBe(1)
  })
})
