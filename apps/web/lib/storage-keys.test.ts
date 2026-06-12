import { describe, it, expect } from 'vitest'
import { photoObjectKeys, avatarObjectKeys } from './storage-keys'

describe('photoObjectKeys', () => {
  it('returns the original plus every variant key', () => {
    const keys = photoObjectKeys({
      storageKey: 'originals/user1/abc.jpg',
      variants: {
        thumb: 'variants/abc/thumb.webp',
        medium: 'variants/abc/medium.webp',
        large: 'variants/abc/large.webp',
      },
    })
    expect(keys).toEqual([
      'originals/user1/abc.jpg',
      'variants/abc/thumb.webp',
      'variants/abc/medium.webp',
      'variants/abc/large.webp',
    ])
  })

  it('handles an unprocessed photo (empty variants object)', () => {
    expect(photoObjectKeys({ storageKey: 'originals/user1/abc.jpg', variants: {} })).toEqual([
      'originals/user1/abc.jpg',
    ])
  })

  it('ignores malformed variants values', () => {
    expect(
      photoObjectKeys({
        storageKey: 'originals/u/x.png',
        variants: { thumb: 42, medium: '', large: null, ok: 'variants/x/large.webp' },
      }),
    ).toEqual(['originals/u/x.png', 'variants/x/large.webp'])
    expect(photoObjectKeys({ storageKey: 'k', variants: null })).toEqual(['k'])
    expect(photoObjectKeys({ storageKey: 'k', variants: ['not-a-map'] })).toEqual(['k'])
  })
})

describe('avatarObjectKeys', () => {
  it('returns the avatar plus its resized variant', () => {
    expect(avatarObjectKeys('avatars/user1/ava.webp')).toEqual([
      'avatars/user1/ava.webp',
      'avatars/user1/ava.avatar-128.webp',
    ])
  })

  it('returns nothing when the user has no avatar', () => {
    expect(avatarObjectKeys(null)).toEqual([])
  })
})
