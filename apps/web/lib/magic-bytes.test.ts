import { describe, expect, it } from 'vitest'
import { matchesMagicBytes } from '@/lib/magic-bytes'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a 16-byte buffer filled with zeros, then patch in the given bytes. */
function makeBuffer(patches: Record<number, number>): Buffer {
  const buf = Buffer.alloc(16, 0x00)
  for (const [offset, value] of Object.entries(patches)) {
    buf[Number(offset)] = value
  }
  return buf
}

const JPEG_HEADER  = { 0: 0xFF, 1: 0xD8, 2: 0xFF }
const PNG_HEADER   = { 0: 0x89, 1: 0x50, 2: 0x4E, 3: 0x47 }
const GIF_HEADER   = { 0: 0x47, 1: 0x49, 2: 0x46 }
// RIFF????WEBP — bytes 0-3 = "RIFF", bytes 8-11 = "WEBP"
const WEBP_HEADER  = {
  0: 0x52, 1: 0x49, 2: 0x46, 3: 0x46,
  8: 0x57, 9: 0x45, 10: 0x42, 11: 0x50,
}

// ─── JPEG ─────────────────────────────────────────────────────────────────────

describe('matchesMagicBytes — image/jpeg', () => {
  it('accepts a valid JPEG header (FF D8 FF)', () => {
    expect(matchesMagicBytes('image/jpeg', makeBuffer(JPEG_HEADER))).toBe(true)
  })

  it('rejects a buffer that starts with zeros', () => {
    expect(matchesMagicBytes('image/jpeg', Buffer.alloc(16))).toBe(false)
  })

  it('rejects a PNG buffer presented as JPEG', () => {
    expect(matchesMagicBytes('image/jpeg', makeBuffer(PNG_HEADER))).toBe(false)
  })

  it('rejects an empty buffer', () => {
    expect(matchesMagicBytes('image/jpeg', Buffer.alloc(0))).toBe(false)
  })

  it('rejects a buffer shorter than the signature (2 bytes)', () => {
    expect(matchesMagicBytes('image/jpeg', Buffer.from([0xFF, 0xD8]))).toBe(false)
  })

  it('rejects when only the first two bytes match', () => {
    expect(matchesMagicBytes('image/jpeg', makeBuffer({ 0: 0xFF, 1: 0xD8, 2: 0x00 }))).toBe(false)
  })
})

// ─── PNG ──────────────────────────────────────────────────────────────────────

describe('matchesMagicBytes — image/png', () => {
  it('accepts a valid PNG header (89 50 4E 47)', () => {
    expect(matchesMagicBytes('image/png', makeBuffer(PNG_HEADER))).toBe(true)
  })

  it('rejects a JPEG buffer presented as PNG', () => {
    expect(matchesMagicBytes('image/png', makeBuffer(JPEG_HEADER))).toBe(false)
  })

  it('rejects an empty buffer', () => {
    expect(matchesMagicBytes('image/png', Buffer.alloc(0))).toBe(false)
  })

  it('rejects when only the first three bytes match', () => {
    expect(matchesMagicBytes('image/png', makeBuffer({ 0: 0x89, 1: 0x50, 2: 0x4E, 3: 0x00 }))).toBe(false)
  })
})

// ─── GIF ──────────────────────────────────────────────────────────────────────

describe('matchesMagicBytes — image/gif', () => {
  it('accepts a valid GIF header (47 49 46)', () => {
    expect(matchesMagicBytes('image/gif', makeBuffer(GIF_HEADER))).toBe(true)
  })

  it('rejects a JPEG buffer presented as GIF', () => {
    expect(matchesMagicBytes('image/gif', makeBuffer(JPEG_HEADER))).toBe(false)
  })

  it('rejects an empty buffer', () => {
    expect(matchesMagicBytes('image/gif', Buffer.alloc(0))).toBe(false)
  })
})

// ─── WebP ─────────────────────────────────────────────────────────────────────

describe('matchesMagicBytes — image/webp', () => {
  it('accepts a valid WebP header (RIFF????WEBP)', () => {
    expect(matchesMagicBytes('image/webp', makeBuffer(WEBP_HEADER))).toBe(true)
  })

  it('rejects when RIFF prefix is present but WEBP fourcc is missing', () => {
    // bytes 8-11 are left as 0x00 — not "WEBP"
    const buf = makeBuffer({ 0: 0x52, 1: 0x49, 2: 0x46, 3: 0x46 })
    expect(matchesMagicBytes('image/webp', buf)).toBe(false)
  })

  it('rejects a JPEG buffer presented as WebP', () => {
    expect(matchesMagicBytes('image/webp', makeBuffer(JPEG_HEADER))).toBe(false)
  })

  it('rejects a buffer shorter than 12 bytes', () => {
    expect(matchesMagicBytes('image/webp', Buffer.alloc(8))).toBe(false)
  })

  it('rejects an empty buffer', () => {
    expect(matchesMagicBytes('image/webp', Buffer.alloc(0))).toBe(false)
  })
})

// ─── AVIF / HEIC (no registered signature — always pass) ─────────────────────

describe('matchesMagicBytes — image/avif and image/heic', () => {
  it('allows any buffer for image/avif (no fixed signature)', () => {
    expect(matchesMagicBytes('image/avif', Buffer.alloc(0))).toBe(true)
    expect(matchesMagicBytes('image/avif', Buffer.alloc(16))).toBe(true)
  })

  it('allows any buffer for image/heic (no fixed signature)', () => {
    expect(matchesMagicBytes('image/heic', Buffer.alloc(0))).toBe(true)
    expect(matchesMagicBytes('image/heic', Buffer.alloc(16))).toBe(true)
  })

  it('allows any buffer for image/heif (no fixed signature)', () => {
    expect(matchesMagicBytes('image/heif', Buffer.alloc(16))).toBe(true)
  })
})

// ─── Unknown MIME type ────────────────────────────────────────────────────────

describe('matchesMagicBytes — unknown MIME type', () => {
  it('allows an unknown MIME type through (no signature registered)', () => {
    expect(matchesMagicBytes('application/octet-stream', Buffer.alloc(16))).toBe(true)
  })
})
