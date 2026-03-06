export function avatarUrl(avatarKey: string | null | undefined): string | null {
  if (!avatarKey) return null
  return `/api/v1/avatar?key=${encodeURIComponent(avatarKey)}`
}
