/**
 * Magic byte validation for uploaded image files.
 *
 * Checks the first bytes of the raw file content against known file signatures
 * so an attacker cannot upload an executable with a spoofed Content-Type header
 * via a presigned PUT URL.
 */

/**
 * HEIC/HEIF and AVIF use ISOBMFF (ISO Base Media File Format) containers.
 * Bytes 4-7 contain "ftyp", followed by a brand identifier.
 * Known brands: heic, heix, hevc, hevx, heim, heis, mif1 (HEIF), avif (AVIF).
 */
function isIsobmff(buf: Buffer, brands: string[]): boolean {
  if (buf.length < 12) return false
  // bytes 4-7 must be "ftyp"
  if (buf[4] !== 0x66 || buf[5] !== 0x74 || buf[6] !== 0x79 || buf[7] !== 0x70) return false
  const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11])
  return brands.includes(brand)
}

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1']
const AVIF_BRANDS = ['avif', 'avis', 'mif1']

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
  'image/heic': (b) => isIsobmff(b, HEIC_BRANDS),
  'image/heif': (b) => isIsobmff(b, HEIC_BRANDS),
  'image/heic-sequence': (b) => isIsobmff(b, HEIC_BRANDS),
  'image/heif-sequence': (b) => isIsobmff(b, HEIC_BRANDS),
  'image/avif': (b) => isIsobmff(b, AVIF_BRANDS),
}

/**
 * Returns true when the buffer's leading bytes match the expected signature for
 * the given MIME type, or when no signature is registered for that type.
 */
export function matchesMagicBytes(mimeType: string, buf: Buffer): boolean {
  const check = MAGIC_SIGNATURES[mimeType]
  if (!check) return true   // no signature defined — allow through
  return check(buf)
}
