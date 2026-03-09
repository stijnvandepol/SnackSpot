const DEFAULT_SITE_URL = 'https://snackspot.online'

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, '')
}

export function getSiteOrigin() {
  return new URL(getSiteUrl())
}
