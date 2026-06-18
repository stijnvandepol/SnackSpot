import { describe, it, expect } from 'vitest'
import { pickLocale } from './locale'

describe('pickLocale', () => {
  it('prefers a valid cookie over the header', () => {
    expect(pickLocale('nl', 'en-US,en;q=0.9')).toBe('nl')
  })
  it('ignores an invalid cookie and uses the header', () => {
    expect(pickLocale('de', 'nl-NL,nl;q=0.9,en;q=0.8')).toBe('nl')
  })
  it('parses the first matching Accept-Language tag', () => {
    expect(pickLocale(undefined, 'fr-FR,fr;q=0.9,en;q=0.8')).toBe('en')
  })
  it('matches the base of a regional tag', () => {
    expect(pickLocale(undefined, 'nl-BE')).toBe('nl')
  })
  it('falls back to en when nothing matches', () => {
    expect(pickLocale(undefined, 'de-DE,fr;q=0.9')).toBe('en')
    expect(pickLocale(undefined, undefined)).toBe('en')
  })
})
