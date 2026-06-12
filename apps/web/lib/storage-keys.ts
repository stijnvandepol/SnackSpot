import { avatarVariantKey } from './avatar'

// GDPR erasure: derive every MinIO object key belonging to a photo or avatar
// so deletion endpoints can remove the files immediately instead of waiting
// for the daily orphan sweep (which remains the safety net). Pure module -
// no env/minio imports - so the derivation is unit-testable.

/** All object keys for one photo: the original plus every generated variant. */
export function photoObjectKeys(photo: { storageKey: string; variants: unknown }): string[] {
  const keys = [photo.storageKey]
  if (photo.variants && typeof photo.variants === 'object' && !Array.isArray(photo.variants)) {
    for (const value of Object.values(photo.variants)) {
      if (typeof value === 'string' && value.length > 0) keys.push(value)
    }
  }
  return keys
}

/** All object keys for an avatar: the original plus its resized variant. */
export function avatarObjectKeys(avatarKey: string | null): string[] {
  if (!avatarKey) return []
  return [avatarKey, avatarVariantKey(avatarKey)]
}
