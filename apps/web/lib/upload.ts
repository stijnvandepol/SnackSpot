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

export function shouldUseDirectBrowserUpload(uploadUrl: string): boolean {
  if (typeof window === 'undefined') return true

  try {
    const target = new URL(uploadUrl, window.location.href)
    return target.origin !== window.location.origin
  } catch {
    return true
  }
}
