/**
 * Magic byte validation for uploaded image files.
 *
 * Checks the first bytes of the raw file content against known file signatures
 * so an attacker cannot upload an executable with a spoofed Content-Type header
 * via a presigned PUT URL.
 *
 * AVIF and HEIC use a variable-length ISOBMFF container header — no simple
 * fixed-offset signature exists for them, so we skip validation and rely on
 * Sharp's decode step in the worker to reject invalid files.
 */

const MAGIC_SIGNATURES: Record<string, (buf: Buffer) => boolean> = {
  'image/jpeg': (b) => b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF,
  'image/png': (b) =>
    b.length >= 4 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47,
  'image/gif': (b) => b.length >= 3 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  // WebP: RIFF????WEBP  (bytes 0-3 = "RIFF", bytes 8-11 = "WEBP")
  'image/webp': (b) =>
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
}

/**
 * Returns true when the buffer's leading bytes match the expected signature for
 * the given MIME type, or when no signature is registered (AVIF / HEIC).
 */
export function matchesMagicBytes(mimeType: string, buf: Buffer): boolean {
  const check = MAGIC_SIGNATURES[mimeType]
  if (!check) return true   // no signature defined — allow through
  return check(buf)
}
