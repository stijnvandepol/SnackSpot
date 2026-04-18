/** Image MIME types accepted for upload. Kept here to avoid duplication across routes. */
export const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
])

export type NormalizedMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' | 'image/heic'

const MIME_ALIASES: Record<string, NormalizedMime> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-jpeg': 'image/jpeg',
  'image/jfif': 'image/jpeg',
  'image/png': 'image/png',
  'image/x-png': 'image/png',
  'image/webp': 'image/webp',
  'image/avif': 'image/avif',
  'image/heic': 'image/heic',
  'image/heif': 'image/heic',
  'image/heic-sequence': 'image/heic',
  'image/heif-sequence': 'image/heic',
}

/** Normalize browser-reported MIME to a canonical type we accept. Falls back to file extension. */
export function normalizeUploadMime(file: File): NormalizedMime | null {
  const rawType = (file.type || '').trim().toLowerCase()
  if (rawType in MIME_ALIASES) return MIME_ALIASES[rawType]

  // Fallback: some browsers (especially mobile) report empty or wrong MIME — check extension
  const name = (file.name || '').toLowerCase()
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.avif')) return 'image/avif'
  if (name.endsWith('.heic') || name.endsWith('.heif')) return 'image/heic'

  return null
}

/** Max client-side image dimension before upload (matches worker large variant). */
export const MAX_CLIENT_IMAGE_DIMENSION = 2048

/** Target quality for client-side JPEG/WebP compression. */
export const CLIENT_COMPRESS_QUALITY = 0.85

/**
 * Compress and resize an image client-side before upload.
 * Converts HEIC and other formats to JPEG via Canvas.
 * Returns a Blob smaller than the original with max dimension of MAX_CLIENT_IMAGE_DIMENSION.
 */
export async function compressImage(file: File): Promise<{ blob: Blob; mime: NormalizedMime }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      const max = MAX_CLIENT_IMAGE_DIMENSION

      // Downscale if needed, preserving aspect ratio
      if (width > max || height > max) {
        if (width > height) {
          height = Math.round(height * (max / width))
          width = max
        } else {
          width = Math.round(width * (max / height))
          height = max
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not supported')); return }
      ctx.drawImage(img, 0, 0, width, height)

      // Encode as JPEG for maximum cross-device compatibility.
      // Why not WebP: canvas.toBlob(_, 'image/webp') is unreliable across
      // iOS Safari and some Samsung Internet builds — when WebP isn't
      // supported the browser silently falls back to PNG/JPEG but still
      // returns a blob, which previously caused the server magic-byte
      // check to reject the upload as "File contents do not match declared type".
      const encodeAsJpeg = () =>
        canvas.toBlob(
          (jpgBlob) => {
            if (jpgBlob) {
              resolve({ blob: jpgBlob, mime: 'image/jpeg' })
            } else {
              reject(new Error('Failed to compress image'))
            }
          },
          'image/jpeg',
          CLIENT_COMPRESS_QUALITY,
        )

      // Prefer WebP when we can verify the browser actually produced WebP.
      canvas.toBlob(
        (blob) => {
          if (blob && blob.type === 'image/webp') {
            resolve({ blob, mime: 'image/webp' })
          } else {
            encodeAsJpeg()
          }
        },
        'image/webp',
        CLIENT_COMPRESS_QUALITY,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for compression'))
    }

    img.src = url
  })
}

// Decide whether to PUT directly to S3/MinIO (true) or proxy through our API (false).
// Direct upload is required when the presigned URL points to a different origin —
// in that case the browser would block a same-origin fetch to our API anyway.
export function shouldUseDirectBrowserUpload(uploadUrl: string): boolean {
  if (typeof window === 'undefined') return true // SSR path: no upload happens
  try {
    const target = new URL(uploadUrl, window.location.href)
    return target.origin !== window.location.origin
  } catch {
    return true // Malformed URL — default to direct to avoid silent failure
  }
}
