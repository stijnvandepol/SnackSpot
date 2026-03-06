'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { ReviewCard } from '@/components/review-card'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Review {
  id: string; rating: number; text: string; dishName?: string | null; createdAt: string; status: string
  likeCount?: number; likedByMe?: boolean
  overallRating?: number
  user: { id: string; username: string; avatarKey?: string | null; role: string }
  place: { id: string; name: string; address: string }
  reviewPhotos: Array<{ photo: { id: string; variants: Record<string, string> } }>
}

interface BadgeRow {
  progressCurrent: number
  progressTarget: number
  earnedAt: string | null
  badge: {
    id: string
    slug: string
    name: string
    description: string
    iconKey: string
    tier: 'BRONZE' | 'SILVER' | 'GOLD'
    criteriaType: string
    criteriaValue: number
  }
}

interface StatsData {
  totalPosts: number
  totalLikesReceived: number
  uniqueLocationsVisited: number
  averageOverallRatingGiven: number | null
  weeklyActivity: Array<{ weekStart: string; posts: number }>
  topLocations: Array<{ id: string; name: string; posts: number }>
  streak: { current: number; best: number }
}

export default function ProfilePage() {
  const { user, accessToken, logout } = useAuth()
  const router = useRouter()
  const [reviews, setReviews] = useState<Review[]>([])
  const [earnedBadges, setEarnedBadges] = useState<BadgeRow[]>([])
  const [inProgressBadges, setInProgressBadges] = useState<BadgeRow[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [selectedBadge, setSelectedBadge] = useState<BadgeRow | null>(null)
  const [loading, setLoading] = useState(false)
  const maxWeeklyPosts = Math.max(1, ...(stats?.weeklyActivity.map((week) => week.posts) ?? [0]))

  useEffect(() => {
    if (!user || !accessToken) return
    setLoading(true)
    Promise.all([
      fetch('/api/v1/me/reviews?limit=20', { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch('/api/v1/me/badges', { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch('/api/v1/me/stats', { headers: { Authorization: `Bearer ${accessToken}` } }),
    ])
      .then(async ([reviewsRes, badgesRes, statsRes]) => {
        const reviewsJson = await reviewsRes.json()
        const badgesJson = await badgesRes.json()
        const statsJson = await statsRes.json()
        setReviews(reviewsJson.data?.data ?? [])
        setEarnedBadges(badgesJson.data?.earned ?? [])
        setInProgressBadges(badgesJson.data?.inProgress ?? [])
        setStats(statsJson.data ?? null)
      })
      .finally(() => setLoading(false))
  }, [user, accessToken])

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-semibold text-snack-text">Log in to view your profile.</p>
        <a href="/auth/login" className="btn-primary mt-4 inline-block">Log in</a>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="card p-6 mb-4 flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-snack-surface flex items-center justify-center text-snack-primary font-bold text-2xl uppercase flex-shrink-0">
          {user.username[0]}
        </div>
        <div className="min-w-0">
          <h1 className="font-heading font-bold text-xl text-snack-text">{user.username}</h1>
          <p className="text-sm text-snack-muted">@{user.username}</p>
          <p className="text-xs text-snack-muted mt-1">Snack hunter & reviewer</p>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
            user.role === 'ADMIN' ? 'bg-red-100 text-red-700'
            : user.role === 'MODERATOR' ? 'bg-purple-100 text-purple-700'
            : 'bg-snack-surface text-snack-muted'
          }`}>
            {user.role}
          </span>
        </div>
        <div className="ml-auto">
          <button
            onClick={async () => { await logout(); router.push('/auth/login') }}
            className="btn-secondary text-sm"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-snack-text">{stats?.totalPosts ?? reviews.length}</p>
          <p className="text-xs text-snack-muted">Posts</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-snack-text">{stats?.totalLikesReceived ?? 0}</p>
          <p className="text-xs text-snack-muted">Likes received</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-snack-text">{earnedBadges.length}</p>
          <p className="text-xs text-snack-muted">Badges</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link href="/add-review" className="btn-primary text-sm py-2 hidden md:inline-flex">+ New Post</Link>
        <Link href={`/u/${user.username}`} className="btn-secondary text-sm py-2">Public Profile</Link>
        <Link href="/feed" className="btn-secondary text-sm py-2 hidden md:inline-flex">Back to Feed</Link>
      </div>

      {stats && (
        <div className="card p-4 mb-6">
          <h2 className="font-heading font-semibold text-snack-text mb-3">My Stats</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-snack-muted">Unique locations</p>
              <p className="font-semibold text-snack-text">{stats.uniqueLocationsVisited}</p>
            </div>
            <div>
              <p className="text-snack-muted">Avg overall given</p>
              <p className="font-semibold text-snack-text">{stats.averageOverallRatingGiven?.toFixed(1) ?? '—'}</p>
            </div>
            <div>
              <p className="text-snack-muted">Current streak</p>
              <p className="font-semibold text-snack-text">{stats.streak.current} days</p>
            </div>
            <div>
              <p className="text-snack-muted">Best streak</p>
              <p className="font-semibold text-snack-text">{stats.streak.best} days</p>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xs text-snack-muted mb-1">Last 8 weeks</p>
            <div className="flex items-end gap-1 h-12">
              {stats.weeklyActivity.map((week) => (
                <div
                  key={week.weekStart}
                  className={`rounded-sm flex-1 ${week.posts > 0 ? 'bg-snack-primary/70' : 'bg-snack-surface'}`}
                  style={{ height: `${week.posts > 0 ? Math.max(8, Math.round((week.posts / maxWeeklyPosts) * 48)) : 4}px` }}
                  title={`${new Date(week.weekStart).toLocaleDateString()}: ${week.posts}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card p-4 mb-6">
        <h2 className="font-heading font-semibold text-snack-text mb-3">Badges</h2>
        {earnedBadges.length === 0 && inProgressBadges.length === 0 ? (
          <p className="text-sm text-snack-muted">No badge progress yet.</p>
        ) : (
          <>
            {earnedBadges.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {earnedBadges.map((row) => (
                  <button
                    key={row.badge.id}
                    type="button"
                    onClick={() => setSelectedBadge(row)}
                    className="text-left border border-snack-border rounded-xl p-2"
                  >
                    <p className="text-sm font-semibold text-snack-text">{row.badge.name}</p>
                    <p className="text-xs text-snack-muted">{row.badge.tier}</p>
                  </button>
                ))}
              </div>
            )}
            {inProgressBadges.length > 0 && (
              <div className="space-y-2">
                {inProgressBadges.map((row) => {
                  const pct = Math.min(100, Math.round((row.progressCurrent / Math.max(1, row.progressTarget)) * 100))
                  return (
                    <button
                      key={row.badge.id}
                      type="button"
                      onClick={() => setSelectedBadge(row)}
                      className="w-full text-left"
                    >
                      <div className="flex justify-between text-xs text-snack-muted mb-1">
                        <span>{row.badge.name}</span>
                        <span>{row.progressCurrent}/{row.progressTarget}</span>
                      </div>
                      <div className="h-2 bg-snack-surface rounded-full overflow-hidden">
                        <div className="h-full bg-snack-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {selectedBadge && (
        <div className="fixed inset-0 z-50 bg-black/35 flex items-end sm:items-center justify-center p-4" onClick={() => setSelectedBadge(null)}>
          <div className="w-full max-w-sm card p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading font-semibold text-snack-text">{selectedBadge.badge.name}</h3>
            <p className="text-xs text-snack-muted mt-1">Tier: {selectedBadge.badge.tier}</p>
            <p className="text-sm text-snack-muted mt-2">{selectedBadge.badge.description}</p>
            <p className="text-sm text-snack-text mt-3">
              Progress: {selectedBadge.progressCurrent}/{selectedBadge.progressTarget}
            </p>
            <button className="btn-secondary w-full mt-4" onClick={() => setSelectedBadge(null)}>Close</button>
          </div>
        </div>
      )}

      <h2 className="font-heading font-semibold text-lg text-snack-text mb-4">My Posts</h2>

      {loading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card h-32 animate-pulse bg-snack-surface" />
          ))}
        </div>
      )}

      {!loading && reviews.length === 0 && (
        <div className="text-center py-12">
          <p className="text-snack-muted text-sm">You haven't written any reviews yet.</p>
          <a href="/add-review" className="btn-primary mt-4 hidden md:inline-block">Add your first review</a>
        </div>
      )}

      <div className="space-y-4">
        {reviews.map((r) => <ReviewCard key={r.id} review={r} backContext="profile" />)}
      </div>
    </div>
  )
}
