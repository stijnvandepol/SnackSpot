import { describe, expect, it } from 'vitest'
import { photoVariantUrl } from './photo-url'

describe('photoVariantUrl — variant selection', () => {
  it('returns a same-origin /api/v1/photos/variant URL', () => {
    const url = photoVariantUrl({ thumb: 'photos/thumb.jpg' })
    expect(url).toBe('/api/v1/photos/variant?key=photos%2Fthumb.jpg')
  })

  it('prefers thumb over medium and large by default', () => {
    const url = photoVariantUrl({ thumb: 'a.jpg', medium: 'b.jpg', large: 'c.jpg' })
    expect(url).toContain(encodeURIComponent('a.jpg'))
  })

  it('falls back to medium when thumb is absent', () => {
    const url = photoVariantUrl({ medium: 'medium.jpg', large: 'large.jpg' })
    expect(url).toContain(encodeURIComponent('medium.jpg'))
  })

  it('falls back to large when thumb and medium are absent', () => {
    const url = photoVariantUrl({ large: 'large.jpg' })
    expect(url).toContain(encodeURIComponent('large.jpg'))
  })

  it('honours a custom preferred order (large first)', () => {
    const url = photoVariantUrl(
      { thumb: 'small.jpg', medium: 'medium.jpg', large: 'large.jpg' },
      ['large', 'medium', 'thumb'],
    )
    expect(url).toContain(encodeURIComponent('large.jpg'))
  })

  it('skips empty-string keys and picks the next non-empty variant', () => {
    const url = photoVariantUrl({ thumb: '', medium: 'fallback.jpg', large: '' })
    expect(url).toContain(encodeURIComponent('fallback.jpg'))
  })
})

describe('photoVariantUrl — null / empty inputs', () => {
  it('returns null when variants is null', () => {
    expect(photoVariantUrl(null)).toBeNull()
  })

  it('returns null when variants is undefined', () => {
    expect(photoVariantUrl(undefined)).toBeNull()
  })

  it('returns null when the variants object is empty', () => {
    expect(photoVariantUrl({})).toBeNull()
  })

  it('returns null when all variant keys are empty strings', () => {
    expect(photoVariantUrl({ thumb: '', medium: '', large: '' })).toBeNull()
  })
})

describe('photoVariantUrl — URL encoding', () => {
  it('URL-encodes forward slashes in the key', () => {
    const url = photoVariantUrl({ thumb: 'folder/subfolder/img.jpg' })
    expect(url).toBe('/api/v1/photos/variant?key=folder%2Fsubfolder%2Fimg.jpg')
  })

  it('URL-encodes spaces in the key', () => {
    const url = photoVariantUrl({ thumb: 'my photo.jpg' })
    expect(url).toBe('/api/v1/photos/variant?key=my%20photo.jpg')
  })

  it('produces a URL that does NOT include the MinIO/S3 hostname', () => {
    // Important security property: the URL must be same-origin to avoid mixed-content issues
    const url = photoVariantUrl({ thumb: 'photos/abc.jpg' })
    expect(url).toMatch(/^\/api\//)
    expect(url).not.toMatch(/^https?:\/\//)
  })
})
