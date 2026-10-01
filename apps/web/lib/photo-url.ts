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

/** Widths the worker renders each variant at (apps/worker VARIANTS); smaller originals stay smaller. */
const VARIANT_WIDTHS = { thumb: 256, medium: 1024, large: 2048 } as const

/**
 * A `srcset` over all stored variants, so the browser picks by real pixel need.
 *
 * Without it every card got the 1024px `medium`, which a 3x phone stretches over a ~1200px
 * wide card and a retina laptop over ~1300px: food photos came out visibly soft. With it the
 * phone downloads `large` only where the screen can show it.
 */
export function photoSrcSet(variants: PhotoVariants | Record<string, string> | null | undefined): string | undefined {
  if (!variants) return undefined
  const entries = VARIANT_ORDER.flatMap((size) => {
    const url = photoVariantUrl(variants, [size])
    return url ? [`${url} ${VARIANT_WIDTHS[size]}w`] : []
  })
  return entries.length > 1 ? entries.join(', ') : undefined
}

