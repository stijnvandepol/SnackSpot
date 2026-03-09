'use client'
import { use, useEffect, useState } from 'react'
import { ReviewCard } from '@/components/review-card'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { TopNav } from '@/components/top-nav'
import { BottomNav } from '@/components/bottom-nav'
import { AvatarLightbox } from '@/components/avatar-lightbox'

interface UserProfile {
  id: string
  username: string
  bio: string | null
  avatarKey: string | null
  role: string
  createdAt: string
  _count: { reviews: number; favorites: number }
  achievements: {
    totalEarned: number
    recent: Array<{
      earnedAt: string | null
      badge: {
        id: string
        slug: string
        name: string
        description: string
        tier: 'BRONZE' | 'SILVER' | 'GOLD'
      }
    }>
  }
  stats: {
    totalPosts: number
    postsLast30Days: number
    totalLikesReceived: number
    totalCommentsReceived: number
    uniqueLocationsVisited: number
    averageOverallRatingGiven: number | null
    topLocations: Array<{ id: string; name: string; posts: number }>
    weeklyActivity: Array<{ weekStart: string; posts: number }>
    streak: { current: number; best: number }
  }
}

interface Review {
  id: string
  rating: number
  text: string
  dishName?: string | null
  createdAt: string
  status: string
  likeCount?: number
  likedByMe?: boolean
  user: { id: string; username: string; avatarKey?: string | null; role: string }
  place: { id: string; name: string; address: string }
  reviewPhotos: Array<{ photo: { id: string; variants: Record<string, string> } }>
}

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  const { accessToken } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const maxWeeklyPosts = Math.max(1, ...(profile?.stats.weeklyActivity.map((week) => week.posts) ?? [0]))

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/v1/users/${encodeURIComponent(username)}`),
      fetch(`/api/v1/users/${encodeURIComponent(username)}/reviews?limit=50`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      }),
    ])
      .then(async ([profileRes, reviewsRes]) => {
        const profileJson = await profileRes.json()
        const reviewsJson = await reviewsRes.json()

        if (!profileRes.ok) {
          setError(profileJson.error ?? 'User not found')
          return
        }

        setProfile(profileJson.data)
        setReviews(reviewsJson.data?.data ?? [])
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [username, accessToken])

  if (error) return (
    <div className="flex min-h-full flex-col">
      <TopNav />
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="font-semibold text-snack-text">{error}</p>
        <Link href="/feed" className="btn-primary mt-4 inline-block">Back to Feed</Link>
      </div>
      <BottomNav />
    </div>
  )

  return (
    <div className="flex min-h-full flex-col">
      <TopNav />
      <main className="flex-1 pb-nav md:pb-0">
        <div className="mx-auto max-w-2xl px-4 py-6">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-20 bg-snack-surface rounded-2xl" />
            </div>
          ) : (
            profile ? (
              <>
                <div className="card p-6 mb-6 flex items-center gap-4">
                  <AvatarLightbox
                    avatarKey={profile.avatarKey}
                    username={profile.username}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <h1 className="font-heading font-bold text-xl text-snack-text">{profile.username}</h1>
                    <p className="text-sm text-snack-muted">@{profile.username}</p>
                    <p className="text-xs text-snack-muted mt-1">{profile.bio?.trim() || 'SnackSpot member'}</p>
                    <p className="text-xs text-snack-muted mt-1">
                      Joined {new Date(profile.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <div className="card p-3 text-center">
                    <p className="text-lg font-bold text-snack-text">{profile.stats.totalPosts}</p>
                    <p className="text-xs text-snack-muted">Posts</p>
                  </div>
                  <div className="card p-3 text-center">
                    <p className="text-lg font-bold text-snack-text">{profile.stats.postsLast30Days}</p>
                    <p className="text-xs text-snack-muted">Past month</p>
                  </div>
                  <div className="card p-3 text-center">
                    <p className="text-lg font-bold text-snack-text">{profile.stats.totalLikesReceived}</p>
                    <p className="text-xs text-snack-muted">Likes received</p>
                  </div>
                  <div className="card p-3 text-center">
                    <p className="text-lg font-bold text-snack-text">{profile.achievements.totalEarned}</p>
                    <p className="text-xs text-snack-muted">Achievements</p>
                  </div>
                </div>

                <div className="card p-4 mb-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-heading font-semibold text-snack-text">Profile Stats</h2>
                    <span className="text-xs text-snack-muted">
                      Avg rating given {profile.stats.averageOverallRatingGiven?.toFixed(1) ?? '—'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-snack-muted">Comments on posts</p>
                      <p className="font-semibold text-snack-text">{profile.stats.totalCommentsReceived}</p>
                    </div>
                    <div>
                      <p className="text-snack-muted">Current streak</p>
                      <p className="font-semibold text-snack-text">{profile.stats.streak.current} days</p>
                    </div>
                    <div>
                      <p className="text-snack-muted">Best streak</p>
                      <p className="font-semibold text-snack-text">{profile.stats.streak.best} days</p>
                    </div>
                    <div>
                      <p className="text-snack-muted">Unique spots</p>
                      <p className="font-semibold text-snack-text">{profile.stats.uniqueLocationsVisited}</p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs text-snack-muted">Posting activity, last 8 weeks</p>
                    <div className="flex h-12 items-end gap-1">
                      {profile.stats.weeklyActivity.map((week) => (
                        <div
                          key={week.weekStart}
                          className={`flex-1 rounded-sm ${week.posts > 0 ? 'bg-snack-primary/70' : 'bg-snack-surface'}`}
                          style={{ height: `${week.posts > 0 ? Math.max(8, Math.round((week.posts / maxWeeklyPosts) * 48)) : 4}px` }}
                          title={`${new Date(week.weekStart).toLocaleDateString()}: ${week.posts}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs text-snack-muted">Top places reviewed</p>
                    {profile.stats.topLocations.length === 0 ? (
                      <p className="text-sm text-snack-muted">No standout places yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {profile.stats.topLocations.map((location) => (
                          <div key={location.id} className="flex items-center justify-between rounded-xl bg-snack-surface px-3 py-2">
                            <p className="text-sm font-medium text-snack-text truncate">{location.name}</p>
                            <p className="text-xs text-snack-muted">{location.posts} posts</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card p-4 mb-6">
                  <h2 className="mb-3 font-heading font-semibold text-snack-text">Recent Achievements</h2>
                  {profile.achievements.recent.length === 0 ? (
                    <p className="text-sm text-snack-muted">No achievements unlocked yet.</p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      {profile.achievements.recent.map((entry) => (
                        <div key={entry.badge.id} className="rounded-xl border border-[#ececec] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-snack-text">{entry.badge.name}</p>
                            <span className="text-[11px] font-medium text-snack-muted">{entry.badge.tier}</span>
                          </div>
                          <p className="mt-1 text-xs text-snack-muted">{entry.badge.description}</p>
                          <p className="mt-2 text-[11px] text-snack-muted">
                            Unlocked {entry.earnedAt ? new Date(entry.earnedAt).toLocaleDateString() : 'recently'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <h2 className="font-heading font-semibold text-snack-text mb-4">Reviews</h2>
                {reviews.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-snack-muted text-sm">No reviews yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((r) => (
                      <ReviewCard
                        key={r.id}
                        review={r}
                        photoVariantPreference={['large', 'medium', 'thumb']}
                        backContext={`user:${username}`}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : null
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
