import { describe, it, expect } from 'vitest'
import { sanitizeUsernameSeed, generateUniqueUsername } from './username'

describe('sanitizeUsernameSeed', () => {
  it('lowercases, strips invalid chars, keeps letters/numbers/underscore', () => {
    expect(sanitizeUsernameSeed('Jürgen O.')).toBe('jrgen_o')
  })

  it('pads short seeds to the 3-char minimum', () => {
    expect(sanitizeUsernameSeed('Al').length).toBeGreaterThanOrEqual(3)
  })

  it('truncates to 30 chars', () => {
    expect(sanitizeUsernameSeed('a'.repeat(50)).length).toBe(30)
  })

  it('falls back to a non-empty base when nothing survives', () => {
    expect(sanitizeUsernameSeed('!!! ###').length).toBeGreaterThanOrEqual(3)
  })
})

describe('generateUniqueUsername', () => {
  it('returns the clean seed when it is free', async () => {
    const out = await generateUniqueUsername('foodie', async () => false)
    expect(out).toBe('foodie')
  })

  it('appends a numeric suffix on collision', async () => {
    const taken = new Set(['foodie', 'foodie1'])
    const out = await generateUniqueUsername('foodie', async (u) => taken.has(u))
    expect(out).toBe('foodie2')
  })

  it('keeps the result within 30 chars even when suffixing a long seed', async () => {
    const out = await generateUniqueUsername('a'.repeat(30), async (u) => u === 'a'.repeat(30))
    expect(out.length).toBeLessThanOrEqual(30)
    expect(out).not.toBe('a'.repeat(30))
  })
})
