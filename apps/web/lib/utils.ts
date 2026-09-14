import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// extractCity lives in @snackspot/shared: the admin app's place-creation and bulk-import
// routes need the same parser, and migration 038's backfill mirrors its rules. Three
// copies drifting apart would split one city into several headings on the landing pages.
// Re-exported here so the many `@/lib/utils` imports keep working.
export { extractCity } from '@snackspot/shared'
