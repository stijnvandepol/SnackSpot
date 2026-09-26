import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({ env: { INDEXNOW_KEY: undefined } }))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }))

import { buildIndexNowPayload } from './indexnow'

const KEY = '0123456789abcdef'

describe('buildIndexNowPayload', () => {
  it('builds absolute URLs, the host and the key location', () => {
    expect(buildIndexNowPayload(['/place/p1', '/review/r1'], KEY, 'https://snackspot.online')).toEqual({
      host: 'snackspot.online',
      key: KEY,
      keyLocation: 'https://snackspot.online/indexnow-key.txt',
      urlList: ['https://snackspot.online/place/p1', 'https://snackspot.online/review/r1'],
    })
  })

  it('dedupes paths and drops anything that is not a same-site path', () => {
    const payload = buildIndexNowPayload(['/a', '/a', '//evil.com/x', 'https://x.y/z'], KEY, 'https://snackspot.online')
    expect(payload?.urlList).toEqual(['https://snackspot.online/a'])
  })

  it.each([
    ['no key', undefined, 'https://snackspot.online'],
    ['plain http', KEY, 'http://snackspot.online'],
    ['localhost', KEY, 'https://localhost:3000'],
    ['LAN address', KEY, 'https://192.168.1.10'],
    ['broken URL', KEY, 'not a url'],
  ])('does nothing with %s', (_label, key, siteUrl) => {
    expect(buildIndexNowPayload(['/place/p1'], key, siteUrl)).toBeNull()
  })

  it('does nothing without paths', () => {
    expect(buildIndexNowPayload([], KEY, 'https://snackspot.online')).toBeNull()
  })
})
