export type PhotoVariants = {
  thumb?: string
  medium?: string
  large?: string
}

const VARIANT_ORDER = ['thumb', 'medium', 'large'] as const

/**
 * Build a same-origin URL for a photo variant key.
 * This avoids mixed-content and cross-origin issues when app + storage hosts differ.
 */
export function photoVariantUrl(
  variants: PhotoVariants | Record<string, string> | null | undefined,
  preferredOrder: ReadonlyArray<(typeof VARIANT_ORDER)[number]> = VARIANT_ORDER,
): string | null {
  if (!variants) return null

  for (const size of preferredOrder) {
    const key = variants[size]
    if (typeof key === 'string' && key.length > 0) {
      return `/api/v1/photos/variant?key=${encodeURIComponent(key)}`
    }
  }

  return null
}

