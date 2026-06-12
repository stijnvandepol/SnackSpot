// GDPR data export (Art. 15 access / Art. 20 portability): pure assembly of
// the per-user export from already-fetched rows. Privacy by Design: every
// field is explicitly allowlisted here - credentials (password hash), token
// hashes and other users' personal data can never leak into an export because
// they are simply never mapped.

export const EXPORT_SCHEMA_VERSION = 1

interface ExportInput {
  user: {
    id: string
    email: string
    username: string
    bio: string | null
    avatarKey: string | null
    timezone: string | null
    role: string
    isVerified: boolean
    emailVerifiedAt: Date | null
    usernameChangedAt: Date | null
    createdAt: Date
    updatedAt: Date
  }
  notificationPreferences: Record<string, unknown> | null
  reviews: Array<{
    id: string
    text: string
    dishName: string | null
    status: string
    rating: unknown
    ratingTaste: unknown
    ratingValue: unknown
    ratingPortion: unknown
    ratingService: unknown
    ratingOverall: unknown
    deletedAt: Date | null
    createdAt: Date
    updatedAt: Date
    place: { name: string; address: string }
    tags: Array<{ tag: string }>
    reviewPhotos: Array<{ photoId: string }>
  }>
  comments: Array<{ id: string; reviewId: string; text: string; createdAt: Date }>
  reviewLikes: Array<{ reviewId: string; createdAt: Date }>
  favorites: Array<{ createdAt: Date; place: { name: string; address: string } }>
  bites: Array<{
    id: string
    photoId: string
    mealSlot: string
    note: string | null
    visibility: string
    localDate: Date
    createdAt: Date
    place: { name: string; address: string } | null
  }>
  photos: Array<{
    id: string
    storageKey: string
    moderationStatus: string
    createdAt: Date
  }>
  badges: Array<{
    progressCurrent: number
    progressTarget: number
    earnedAt: Date | null
    badge: { name: string; description: string; tier: string }
  }>
  userStats: { xpTotal: number; level: number; bitesCount: number } | null
  xpEvents: Array<{ amount: number; reason: string; createdAt: Date }>
  notifications: Array<{ type: string; title: string; message: string; isRead: boolean; createdAt: Date }>
  following: Array<{ createdAt: Date; followee: { username: string } }>
  followers: Array<{ createdAt: Date; follower: { username: string } }>
  reports: Array<{ targetType: string; reason: string; status: string; createdAt: Date }>
  pushSubscriptions: Array<{ endpoint: string; userAgent: string | null; createdAt: Date }>
  userQuests: Array<{ title: string; progress: number; target: number; assignedDate: Date; completedAt: Date | null }>
  userCollectibles: Array<{ earnedAt: Date; collectible: { name: string } }>
}

/** Maps fetched rows to the export files: `filename -> JSON-serialisable value`. */
export function buildExportFiles(input: ExportInput, exportedAt: Date): Record<string, unknown> {
  const { user } = input

  return {
    'manifest.json': {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: exportedAt.toISOString(),
      application: 'SnackSpot',
      description:
        'Export of all personal data SnackSpot stores about your account (GDPR Art. 15/20). ' +
        'Photos you uploaded are included under photos/.',
    },
    'profile.json': {
      id: user.id,
      email: user.email,
      username: user.username,
      bio: user.bio,
      avatarKey: user.avatarKey,
      timezone: user.timezone,
      role: user.role,
      isVerified: user.isVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      usernameChangedAt: user.usernameChangedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      notificationPreferences: input.notificationPreferences,
    },
    'reviews.json': input.reviews.map((r) => ({
      id: r.id,
      place: r.place,
      text: r.text,
      dishName: r.dishName,
      status: r.status,
      rating: Number(r.rating),
      ratings: {
        taste: Number(r.ratingTaste),
        value: Number(r.ratingValue),
        portion: Number(r.ratingPortion),
        service: r.ratingService === null ? null : Number(r.ratingService),
        overall: Number(r.ratingOverall),
      },
      tags: r.tags.map((t) => t.tag),
      photoIds: r.reviewPhotos.map((p) => p.photoId),
      deletedAt: r.deletedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    'comments.json': input.comments,
    'likes.json': input.reviewLikes,
    'favorites.json': input.favorites.map((f) => ({ place: f.place, createdAt: f.createdAt })),
    'bites.json': input.bites,
    'photos.json': input.photos,
    'badges.json': input.badges.map((b) => ({
      name: b.badge.name,
      description: b.badge.description,
      tier: b.badge.tier,
      progressCurrent: b.progressCurrent,
      progressTarget: b.progressTarget,
      earnedAt: b.earnedAt,
    })),
    'stats.json': { stats: input.userStats, xpEvents: input.xpEvents },
    'notifications.json': input.notifications,
    'follows.json': {
      following: input.following.map((f) => ({ username: f.followee.username, since: f.createdAt })),
      followers: input.followers.map((f) => ({ username: f.follower.username, since: f.createdAt })),
    },
    'reports.json': input.reports,
    'push-subscriptions.json': input.pushSubscriptions,
    'quests.json': input.userQuests,
    'collectibles.json': input.userCollectibles.map((c) => ({ name: c.collectible.name, earnedAt: c.earnedAt })),
  }
}
