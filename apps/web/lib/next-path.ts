/**
 * Where to send someone after they log in or register.
 *
 * Before this existed every auth flow ended on `/`. Someone who tapped "Schrijf een review"
 * on a place page while logged out lost the place on the way through the login form, at
 * exactly the moment they had decided to contribute.
 *
 * The value arrives from a query string (and, for Google, a cookie), so it is untrusted:
 * only same-site absolute paths pass. Anything else — `//evil.com`, `/\evil.com`,
 * `https://…`, control characters, the auth pages themselves — falls back to `/`.
 */
const MAX_NEXT_PATH_LENGTH = 512

export const DEFAULT_NEXT_PATH = '/'

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_NEXT_PATH
  if (raw.length > MAX_NEXT_PATH_LENGTH) return DEFAULT_NEXT_PATH
  if (!raw.startsWith('/')) return DEFAULT_NEXT_PATH
  // Protocol-relative (`//host`) and the backslash variant browsers normalise to it.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return DEFAULT_NEXT_PATH
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (/[\u0000-\u001f\u007f]/.test(raw)) return DEFAULT_NEXT_PATH
  // Looping back into the auth pages would strand the user on a form they just completed.
  if (raw === '/auth' || raw.startsWith('/auth/') || raw.startsWith('/api/')) return DEFAULT_NEXT_PATH

  // Final check with the URL parser: the resolved origin must be unchanged.
  try {
    const base = 'https://snackspot.invalid'
    const resolved = new URL(raw, base)
    if (resolved.origin !== base) return DEFAULT_NEXT_PATH
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return DEFAULT_NEXT_PATH
  }
}

/** `/auth/login?next=…` for a given destination; omits the parameter for the default. */
export function authHref(page: 'login' | 'register', next: string | null | undefined): string {
  const target = safeNextPath(next)
  return target === DEFAULT_NEXT_PATH
    ? `/auth/${page}`
    : `/auth/${page}?next=${encodeURIComponent(target)}`
}
