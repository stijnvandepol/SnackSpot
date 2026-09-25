import { describe, expect, it } from 'vitest'
import { authHref, safeNextPath } from './next-path'

describe('safeNextPath', () => {
  it('keeps same-site paths with query and hash', () => {
    expect(safeNextPath('/add-review?placeId=abc')).toBe('/add-review?placeId=abc')
    expect(safeNextPath('/place/123#reviews')).toBe('/place/123#reviews')
  })

  it.each([
    null,
    undefined,
    '',
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    'javascript:alert(1)',
    'evil.com/path',
    '/auth/login',
    '/auth',
    '/api/v1/auth/logout',
    '/foo\nbar',
    `/${'a'.repeat(600)}`,
  ])('falls back to / for %s', (input) => {
    expect(safeNextPath(input)).toBe('/')
  })
})

describe('authHref', () => {
  it('encodes the destination', () => {
    expect(authHref('login', '/add-review?placeId=abc')).toBe(
      '/auth/login?next=%2Fadd-review%3FplaceId%3Dabc',
    )
  })

  it('drops the parameter for the default destination or unsafe input', () => {
    expect(authHref('register', '/')).toBe('/auth/register')
    expect(authHref('register', '//evil.com')).toBe('/auth/register')
  })
})
