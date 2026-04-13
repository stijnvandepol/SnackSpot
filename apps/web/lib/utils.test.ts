import { describe, expect, it } from 'vitest'
import { extractCity, cn } from './utils'

// ─── extractCity ──────────────────────────────────────────────────────────────

describe('extractCity — postal-code + city format', () => {
  it('extracts city from "Street Nr, 1234 AB City, Country"', () => {
    expect(extractCity('Kerkstraat 12, 1234 AB Amsterdam, Netherlands')).toBe('Amsterdam')
  })

  it('extracts city from "1234 AB City" with no street', () => {
    expect(extractCity('1234 AB Amsterdam')).toBe('Amsterdam')
  })

  it('extracts city from "5446 PJ City" format', () => {
    expect(extractCity('5446 PJ Haps')).toBe('Haps')
  })

  it('handles compact postal code "1234ABCity" combined', () => {
    // If Nominatim returns "1234AB Amsterdam", the regex should still match
    expect(extractCity('1234AB Amsterdam')).toBe('Amsterdam')
  })
})

describe('extractCity — comma-separated "Street, City, ..." format', () => {
  it('returns the second meaningful part when it is the city', () => {
    expect(extractCity('Dorpstraat 1, Amsterdam, Noord-Holland, Nederland')).toBe('Amsterdam')
  })

  it('skips provinces correctly (Noord-Holland, Utrecht, etc.)', () => {
    expect(extractCity('Ringbaan-West 10, Tilburg, Noord-Brabant, Nederland')).toBe('Tilburg')
  })

  it('handles address with municipality between street and province', () => {
    expect(extractCity('Peelstraat, Wanroij, Land van Cuijk, Noord-Brabant, Nederland')).toBe('Wanroij')
  })

  it('extracts city even when a house number is a separate part', () => {
    expect(extractCity('Campusbaan, 6, Nijmegen')).toBe('Nijmegen')
  })
})

describe('extractCity — country-only and skip-list addresses', () => {
  it('returns null for "Nederland" alone', () => {
    expect(extractCity('Nederland')).toBeNull()
  })

  it('returns null for "Netherlands" alone', () => {
    expect(extractCity('Netherlands')).toBeNull()
  })

  it('returns null when the only candidate looks like a street', () => {
    expect(extractCity('Kerkstraat 12')).toBeNull()
  })

  it('returns null for a standalone postal code', () => {
    expect(extractCity('5446 PJ')).toBeNull()
  })
})

describe('extractCity — Belgian and German addresses', () => {
  it('skips "Belgium" as a country', () => {
    expect(extractCity('Grote Markt 1, Brussel, Belgium')).toBe('Brussel')
  })

  it('skips "Deutschland" / "Germany" as a country', () => {
    expect(extractCity('Hauptstraße 1, Köln, Germany')).toBe('Köln')
  })
})

// ─── cn (tailwind-merge + clsx) ───────────────────────────────────────────────

describe('cn — class name merging', () => {
  it('merges two separate class strings', () => {
    expect(cn('text-sm', 'font-bold')).toBe('text-sm font-bold')
  })

  it('resolves Tailwind conflicts — last value wins', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('ignores falsy conditional values', () => {
    expect(cn('base', false && 'ignored', null, undefined, 'applied')).toBe('base applied')
  })

  it('supports object syntax from clsx', () => {
    expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500')
  })

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('')
  })

  it('returns empty string for only falsy arguments', () => {
    expect(cn(false, null, undefined)).toBe('')
  })
})
