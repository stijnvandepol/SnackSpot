const MIN_LEN = 3
const MAX_LEN = 30

/** Reduce an arbitrary seed (name/email local-part) to a valid username base:
 *  lowercase, only [a-z0-9_], 3–30 chars.
 *
 *  Accented/non-ASCII letters are dropped (e.g. "Jürgen" -> "jrgen"), while
 *  separator characters (whitespace, punctuation) collapse to a single
 *  underscore. Leading/trailing underscores are trimmed. */
export function sanitizeUsernameSeed(seed: string): string {
  let base = seed
    .toLowerCase()
    .replace(/[^a-z0-9_\s.\-]+/g, '') // drop non-ASCII letters and stray symbols
    .replace(/[\s.\-]+/g, '_')        // collapse separator runs to one underscore
    .replace(/_+/g, '_')              // collapse any underscore runs
    .replace(/^_+|_+$/g, '')          // trim leading/trailing underscores
    .slice(0, MAX_LEN)

  if (base.length < MIN_LEN) base = (base + 'user').slice(0, MIN_LEN)
  return base
}

/** Find a free username derived from `seed`. `exists` returns true if a
 *  username is already taken. On collision, append an incrementing numeric
 *  suffix, trimming the base so the total stays within 30 chars. */
export async function generateUniqueUsername(
  seed: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = sanitizeUsernameSeed(seed)
  if (!(await exists(base))) return base

  for (let n = 1; n < 10000; n++) {
    const suffix = String(n)
    const candidate = base.slice(0, MAX_LEN - suffix.length) + suffix
    if (!(await exists(candidate))) return candidate
  }
  // Exhausted — fall back to a time-based tail (caller's exists check still guards).
  return base.slice(0, MAX_LEN - 6) + String(Date.now()).slice(-6)
}
