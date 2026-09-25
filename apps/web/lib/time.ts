const utcMediumDate = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeZone: 'UTC' })

/** Formats a date as e.g. "12 jun 2026" (UTC, matching the app's Dutch UI copy). */
export function formatDateMedium(date: Date | string): string {
  return utcMediumDate.format(typeof date === 'string' ? new Date(date) : date)
}

/**
 * Formats a date as a short Dutch relative time string ("zojuist", "5 min",
 * "3 u", "2 d"), falling back to a short date ("8 jun") after a week.
 */
export function timeAgo(date: Date | string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'zojuist'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} u`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} d`
  return new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}
