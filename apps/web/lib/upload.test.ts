import { describe, expect, it, vi, afterEach } from 'vitest'
import { ALLOWED_IMAGE_MIMES, shouldUseDirectBrowserUpload } from '@/lib/upload'

// ─── ALLOWED_IMAGE_MIMES ──────────────────────────────────────────────────────

describe('ALLOWED_IMAGE_MIMES', () => {
  it('allows JPEG', () => {
    expect(ALLOWED_IMAGE_MIMES.has('image/jpeg')).toBe(true)
  })

  it('allows PNG', () => {
    expect(ALLOWED_IMAGE_MIMES.has('image/png')).toBe(true)
  })

  it('allows WebP', () => {
    expect(ALLOWED_IMAGE_MIMES.has('image/webp')).toBe(true)
  })

  it('allows AVIF', () => {
    expect(ALLOWED_IMAGE_MIMES.has('image/avif')).toBe(true)
  })

  it('allows HEIC', () => {
    expect(ALLOWED_IMAGE_MIMES.has('image/heic')).toBe(true)
  })

  it('allows HEIF', () => {
    expect(ALLOWED_IMAGE_MIMES.has('image/heif')).toBe(true)
  })

  it('allows HEIC sequence', () => {
    expect(ALLOWED_IMAGE_MIMES.has('image/heic-sequence')).toBe(true)
  })

  it('allows HEIF sequence', () => {
    expect(ALLOWED_IMAGE_MIMES.has('image/heif-sequence')).toBe(true)
  })

  it('rejects executables', () => {
    expect(ALLOWED_IMAGE_MIMES.has('application/octet-stream')).toBe(false)
    expect(ALLOWED_IMAGE_MIMES.has('application/x-executable')).toBe(false)
  })

  it('rejects PHP and other server-side scripts', () => {
    expect(ALLOWED_IMAGE_MIMES.has('application/x-httpd-php')).toBe(false)
    expect(ALLOWED_IMAGE_MIMES.has('text/x-php')).toBe(false)
  })

  it('rejects SVG (can contain embedded scripts)', () => {
    expect(ALLOWED_IMAGE_MIMES.has('image/svg+xml')).toBe(false)
  })

  it('rejects HTML disguised as an image', () => {
    expect(ALLOWED_IMAGE_MIMES.has('text/html')).toBe(false)
  })

  it('rejects GIF (not in allowlist)', () => {
    // GIF is intentionally excluded — update this test if policy changes
    expect(ALLOWED_IMAGE_MIMES.has('image/gif')).toBe(false)
  })

  it('rejects uppercase variants (MIME types are case-sensitive in this set)', () => {
    expect(ALLOWED_IMAGE_MIMES.has('IMAGE/JPEG')).toBe(false)
    expect(ALLOWED_IMAGE_MIMES.has('Image/Png')).toBe(false)
  })
})

// ─── shouldUseDirectBrowserUpload ────────────────────────────────────────────

describe('shouldUseDirectBrowserUpload — server side (window undefined)', () => {
  // In the Node.js test environment window is undefined, so the function
  // always returns true (the server-side / SSR code path).

  it('returns true when window is undefined (server / SSR context)', () => {
    expect(typeof window).toBe('undefined')
    expect(shouldUseDirectBrowserUpload('http://minio.internal/bucket/key')).toBe(true)
  })

  it('returns true for any URL when window is undefined', () => {
    expect(shouldUseDirectBrowserUpload('https://cdn.example.com/upload')).toBe(true)
    expect(shouldUseDirectBrowserUpload('/')).toBe(true)
  })
})

describe('shouldUseDirectBrowserUpload — browser side (window defined)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns true when the upload URL origin differs from window.location.origin (external MinIO)', () => {
    vi.stubGlobal('window', { location: { href: 'https://app.snackspot.com/', origin: 'https://app.snackspot.com' } })
    expect(shouldUseDirectBrowserUpload('https://minio.snackspot.com/bucket/key')).toBe(true)
  })

  it('returns false when the upload URL is same-origin as the app (fallback route)', () => {
    vi.stubGlobal('window', { location: { href: 'https://app.snackspot.com/', origin: 'https://app.snackspot.com' } })
    expect(shouldUseDirectBrowserUpload('https://app.snackspot.com/api/v1/photos/upload-fallback')).toBe(false)
  })

  it('returns true for an invalid URL (conservative fallback)', () => {
    vi.stubGlobal('window', { location: { href: 'https://app.snackspot.com/', origin: 'https://app.snackspot.com' } })
    expect(shouldUseDirectBrowserUpload('not-a-valid-url-:://')).toBe(true)
  })
})
