// GDPR helpers: review restore window and privacy-audit action names.

/** Days a self-deleted review stays restorable before the worker purges it. */
export const RESTORE_WINDOW_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/** Privacy-sensitive actions recorded in the privacy audit log. */
export type PrivacyAction =
  | 'ACCOUNT_DELETED'
  | 'DATA_EXPORTED'
  | 'PHOTO_DELETED'
  | 'REVIEW_PURGED'

/** True while `deletedAt` is within the restore window. */
export function isWithinRestoreWindow(deletedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - deletedAt.getTime() <= RESTORE_WINDOW_DAYS * DAY_MS
}

/** The moment a soft-deleted review stops being restorable (= purge eligibility). */
export function restorableUntil(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + RESTORE_WINDOW_DAYS * DAY_MS)
}

export type RestoreDenialReason = 'NOT_OWNER' | 'MOD_DELETED' | 'WINDOW_EXPIRED'

/**
 * May `userId` restore this soft-deleted review?
 * Only the owner may restore, only when they deleted it themselves (a
 * moderator takedown is not undoable by the owner), and only within the window.
 * Reviews soft-deleted before the deleted_by column existed (null) are treated
 * as self-deleted - deletion was self-service only back then.
 */
export function canRestoreReview(
  review: { userId: string; deletedAt: Date | null; deletedById: string | null },
  userId: string,
  now: Date = new Date(),
): { allowed: true } | { allowed: false; reason: RestoreDenialReason } {
  if (review.userId !== userId) return { allowed: false, reason: 'NOT_OWNER' }
  if (review.deletedById !== null && review.deletedById !== review.userId) {
    return { allowed: false, reason: 'MOD_DELETED' }
  }
  if (!review.deletedAt || !isWithinRestoreWindow(review.deletedAt, now)) {
    return { allowed: false, reason: 'WINDOW_EXPIRED' }
  }
  return { allowed: true }
}
