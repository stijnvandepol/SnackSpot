import { describe, it, expect } from 'vitest'
import { buildExportFiles, EXPORT_SCHEMA_VERSION } from './export-data'

const now = new Date('2026-06-12T12:00:00Z')

function minimalInput() {
  return {
    user: {
      id: 'u1',
      email: 'user@example.com',
      username: 'snacker',
      bio: 'I eat',
      avatarKey: 'avatars/u1/a.webp',
      timezone: 'Europe/Amsterdam',
      role: 'USER',
      isVerified: true,
      emailVerifiedAt: now,
      usernameChangedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    notificationPreferences: { emailOnComment: true },
    reviews: [
      {
        id: 'r1',
        text: 'Great fries',
        dishName: 'Fries',
        status: 'PUBLISHED',
        rating: 4.5,
        ratingTaste: 4,
        ratingValue: 5,
        ratingPortion: 4,
        ratingService: null,
        ratingOverall: 4.5,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        place: { name: 'Snackbar', address: 'Main St 1' },
        tags: [{ tag: 'fries' }],
        reviewPhotos: [{ photoId: 'p1' }],
      },
    ],
    comments: [{ id: 'c1', reviewId: 'r1', text: 'Agreed', createdAt: now }],
    reviewLikes: [{ reviewId: 'r2', createdAt: now }],
    favorites: [{ createdAt: now, place: { name: 'Snackbar', address: 'Main St 1' } }],
    bites: [],
    photos: [{ id: 'p1', storageKey: 'originals/u1/p1.jpg', moderationStatus: 'APPROVED', createdAt: now }],
    badges: [
      {
        progressCurrent: 3,
        progressTarget: 5,
        earnedAt: null,
        badge: { name: 'Explorer', description: 'Visit places', tier: 'BRONZE' },
      },
    ],
    userStats: { xpTotal: 120, level: 2, bitesCount: 4 },
    xpEvents: [{ amount: 10, reason: 'review', createdAt: now }],
    notifications: [{ type: 'REVIEW_LIKE', title: 't', message: 'm', isRead: true, createdAt: now }],
    following: [{ createdAt: now, followee: { username: 'foodie' } }],
    followers: [{ createdAt: now, follower: { username: 'fan' } }],
    reports: [{ targetType: 'REVIEW', reason: 'spam', status: 'OPEN', createdAt: now }],
    pushSubscriptions: [{ endpoint: 'https://push.example/x', userAgent: 'UA', createdAt: now }],
    userQuests: [{ title: 'Quest', progress: 1, target: 2, assignedDate: now, completedAt: null }],
    userCollectibles: [{ earnedAt: now, collectible: { name: 'Stamp' } }],
  }
}

describe('buildExportFiles', () => {
  it('includes a manifest with schema version and timestamp', () => {
    const files = buildExportFiles(minimalInput(), now)
    expect(files['manifest.json']).toMatchObject({
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: now.toISOString(),
    })
  })

  it('contains the profile with email and preferences', () => {
    const files = buildExportFiles(minimalInput(), now)
    expect(files['profile.json']).toMatchObject({
      id: 'u1',
      email: 'user@example.com',
      username: 'snacker',
      notificationPreferences: { emailOnComment: true },
    })
  })

  it('flattens review ratings, tags and photo ids', () => {
    const files = buildExportFiles(minimalInput(), now)
    const reviews = files['reviews.json'] as Array<Record<string, unknown>>
    expect(reviews[0]).toMatchObject({
      id: 'r1',
      rating: 4.5,
      ratings: { taste: 4, value: 5, portion: 4, service: null, overall: 4.5 },
      tags: ['fries'],
      photoIds: ['p1'],
    })
  })

  it('exposes follower/following usernames only (no other personal data of third parties)', () => {
    const files = buildExportFiles(minimalInput(), now)
    expect(files['follows.json']).toEqual({
      following: [{ username: 'foodie', since: now }],
      followers: [{ username: 'fan', since: now }],
    })
  })

  it('never includes credentials or token material anywhere in the export', () => {
    // Defence in depth: even if someone passes a row containing sensitive
    // fields, the allowlist mapping must drop them.
    const input = minimalInput()
    ;(input.user as Record<string, unknown>).passwordHash = 'argon2id$SECRET'
    ;(input.user as Record<string, unknown>).refreshTokens = [{ tokenHash: 'HASH' }]

    const serialized = JSON.stringify(buildExportFiles(input, now))
    expect(serialized).not.toContain('SECRET')
    expect(serialized).not.toContain('passwordHash')
    expect(serialized).not.toContain('tokenHash')
  })
})
