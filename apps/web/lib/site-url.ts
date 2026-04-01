const DEFAULT_SITE_URL = 'https://snackspot.online'

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, '')
}

export function getSiteOrigin(): URL {
  return new URL(getSiteUrl())
}
