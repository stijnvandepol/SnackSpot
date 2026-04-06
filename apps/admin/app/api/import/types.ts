// ── Schema version ───────────────────────────────────────────────

export const CURRENT_SCHEMA_VERSION = 1

// ── Table import order (FK dependency order) ─────────────────────
// Must match TABLE_FILES in apps/admin/app/api/export/route.ts

export const IMPORT_TABLE_ORDER = [
  'users.json',
  'places.json',
  'reviews.json',
  'photos.json',
  'review-photos.json',
  'comments.json',
  'badges.json',
  'user-badges.json',
  'review-likes.json',
  'favorites.json',
  'reports.json',
  'moderation-actions.json',
  'notifications.json',
  'notification-preferences.json',
  'review-mentions.json',
  'review-tags.json',
  'blocked-words.json',
  'flagged-comments.json',
] as const

// ── Per-table import statistics ──────────────────────────────────

export interface ImportTableStats {
  imported: number
  skipped: number
  errors: string[]
}

// ── Photo import statistics ───────────────────────────────────────

export interface PhotoImportStats {
  uploaded: number
  skipped: number
  errors: string[]
}

// ── Import response shape ────────────────────────────────────────

export interface ImportSummary {
  success: boolean
  schemaVersion: number
  exportedAt: string
  tablesProcessed: number
  totalImported: number
  totalSkipped: number
  tables: Record<string, ImportTableStats>
  photos?: PhotoImportStats
  error?: string
}

// ── ID remapping maps ─────────────────────────────────────────────
// Maps export-time IDs to new DB-generated IDs after insert.
// Junction tables with compound PKs (ReviewLike, Favorite, ReviewTag,
// UserBadge, ReviewPhoto, NotificationPreferences) do not need their own map.

export type IdMaps = {
  users: Map<string, string>
  places: Map<string, string>
  reviews: Map<string, string>
  photos: Map<string, string>
  comments: Map<string, string>
  badges: Map<string, string>
  reports: Map<string, string>
  moderationActions: Map<string, string>
  notifications: Map<string, string>
  reviewMentions: Map<string, string>
  blockedWords: Map<string, string>
  flaggedComments: Map<string, string>
}

// ── Factory ───────────────────────────────────────────────────────

export function createEmptyIdMaps(): IdMaps {
  return {
    users: new Map(),
    places: new Map(),
    reviews: new Map(),
    photos: new Map(),
    comments: new Map(),
    badges: new Map(),
    reports: new Map(),
    moderationActions: new Map(),
    notifications: new Map(),
    reviewMentions: new Map(),
    blockedWords: new Map(),
    flaggedComments: new Map(),
  }
}

// ── FK remap helpers ──────────────────────────────────────────────

/** Remap a nullable FK field. Returns null if oldId is null/undefined or mapping not found. */
export function remap(map: Map<string, string>, oldId: string | null | undefined): string | null {
  if (oldId == null) return null
  return map.get(oldId) ?? null
}

/** Remap a non-nullable FK field. Throws if the mapping is missing. */
export function remapRequired(map: Map<string, string>, oldId: string, context: string): string {
  const newId = map.get(oldId)
  if (!newId) throw new Error(`Missing ID mapping for ${context}: ${oldId}`)
  return newId
}
