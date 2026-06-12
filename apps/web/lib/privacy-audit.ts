import type { Prisma } from '@prisma/client'
import { prisma } from './db'
import { logger } from './logger'
import type { PrivacyAction } from './privacy'

/**
 * Append an entry to the privacy audit log (GDPR Art. 5(2) accountability).
 * Best-effort by design: a failing audit write is logged but never blocks the
 * user from exercising their rights (deletion/export must always succeed).
 * Only the opaque user id goes in - never email/username - so the log stays
 * unlinkable to a person once the account is erased.
 */
export async function logPrivacyAction(
  userId: string,
  action: PrivacyAction,
  metadata: Prisma.InputJsonObject = {},
): Promise<void> {
  try {
    await prisma.privacyAuditLog.create({ data: { userId, action, metadata } })
  } catch (err) {
    logger.error({ err, userId, action }, 'Failed to write privacy audit log entry')
  }
}
