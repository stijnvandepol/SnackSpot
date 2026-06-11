/**
 * Formats a date as a human-readable relative time string (English, matching
 * the app's `<html lang="en">` and English UI copy).
 */
export function timeAgo(date: Date | string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
