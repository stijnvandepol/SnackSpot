export function avatarUrl(avatarKey: string | null | undefined): string | null {
  if (!avatarKey) return null
  return `/api/v1/avatar?key=${encodeURIComponent(avatarKey)}`
}

export const AVATAR_VARIANT_SIZE = 128

export function avatarVariantKey(avatarKey: string): string {
  const trimmed = avatarKey.replace(/^\/+/, '')
  const lastDot = trimmed.lastIndexOf('.')
  const base = lastDot >= 0 ? trimmed.slice(0, lastDot) : trimmed
  return `${base}.avatar-${AVATAR_VARIANT_SIZE}.webp`
}
