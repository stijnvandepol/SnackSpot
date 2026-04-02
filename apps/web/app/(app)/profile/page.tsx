'use client'
import { useEffect, useState, Suspense } from 'react'
import { useAuth } from '@/components/auth-provider'
import { ReviewCard } from '@/components/review-card'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AvatarLightbox } from '@/components/avatar-lightbox'
import { VerifiedBadge } from '@/components/verified-badge'
import { NotificationSettings } from '@/components/notification-settings'
import { ThemeSettings } from '@/components/theme-settings'
import dynamic from 'next/dynamic'

const NotificationsList = dynamic(() => import('@/components/notifications-list'), {
  ssr: false,
  loading: () => <div className="space-y-3 flex-1">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="card h-16 animate-pulse bg-snack-surface" />
    ))}
  </div>,
})

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

interface MeProfile {
  id: string
  email: string
  username: string
  bio: string | null
  avatarKey: string | null
  usernameChangedAt: string | null
  usernameCanChangeNow: boolean
  nextUsernameChangeAt: string | null
  role: string
  isVerified: boolean
}

function ProfileContent() {
  const { user, accessToken, logout, reloadMe } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'posts'
  const profileTabs = ['posts', 'stats', 'notifications', 'settings'] as const
  const [reviews, setReviews] = useState<Review[]>([])
  const [earnedBadges, setEarnedBadges] = useState<BadgeRow[]>([])
  const [inProgressBadges, setInProgressBadges] = useState<BadgeRow[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [meProfile, setMeProfile] = useState<MeProfile | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editBio, setEditBio] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [selectedBadge, setSelectedBadge] = useState<BadgeRow | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState<boolean | null>(null)
  const maxWeeklyPosts = Math.max(1, ...(stats?.weeklyActivity.map((week) => week.posts) ?? [0]))

  useEffect(() => {
    if (!user || !accessToken) return
    setLoading(true)
    Promise.all([
      fetch('/api/v1/me/reviews?limit=20', { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch('/api/v1/me/badges', { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch('/api/v1/me/stats', { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch('/api/v1/me/profile', { headers: { Authorization: `Bearer ${accessToken}` } }),
    ])
      .then(async ([reviewsRes, badgesRes, statsRes, profileRes]) => {
        const reviewsJson = await reviewsRes.json()
        const badgesJson = await badgesRes.json()
        const statsJson = await statsRes.json()
        const profileJson = await profileRes.json()
        setReviews(reviewsJson.data?.data ?? [])
        setEarnedBadges(badgesJson.data?.earned ?? [])
        setInProgressBadges(badgesJson.data?.inProgress ?? [])
        setStats(statsJson.data ?? null)

        if (profileRes.ok && profileJson.data) {
          setMeProfile(profileJson.data)
          setEditUsername(profileJson.data.username ?? '')
          setEditBio(profileJson.data.bio ?? '')
        }
      })
      .finally(() => setLoading(false))
  }, [user, accessToken])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches)

    syncViewport()
    mediaQuery.addEventListener('change', syncViewport)
    return () => mediaQuery.removeEventListener('change', syncViewport)
  }, [])

  const handleAvatarUpload = async (file: File | null) => {
    if (!file || !accessToken) return

    setAvatarUploading(true)
    setProfileError(null)
    setProfileMessage(null)

    try {
      const res = await fetch('/api/v1/me/avatar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setProfileError(json.error ?? 'Avatar upload failed')
        return
      }

      setMeProfile((prev) => prev ? { ...prev, avatarKey: json.data.avatarKey } : prev)
      await reloadMe()
      setProfileMessage('Profile image updated.')
    } catch {
      setProfileError('Avatar upload failed')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!accessToken || !meProfile) return

    setProfileSaving(true)
    setProfileError(null)
    setProfileMessage(null)

    try {
      const res = await fetch('/api/v1/me/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          username: editUsername.trim(),
          bio: editBio,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setProfileError(json.error ?? 'Failed to save profile')
        return
      }

      setMeProfile(json.data)
      setEditUsername(json.data.username ?? '')
      setEditBio(json.data.bio ?? '')
      await reloadMe()
      setProfileMessage('Profile updated.')
    } catch {
      setProfileError('Failed to save profile')
    } finally {
      setProfileSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!accessToken || !deletePassword) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/v1/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
        body: JSON.stringify({ password: deletePassword }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDeleteError(json.error ?? 'Failed to delete account')
        return
      }
      await logout()
      router.push('/auth/login')
    } catch {
      setDeleteError('Failed to delete account')
    } finally {
      setDeleteLoading(false)
    }
  }

  const dangerZone = (
    <div className="card p-4 border border-red-200">
      <h3 className="font-heading font-semibold text-red-600 mb-1">Danger Zone</h3>
      <p className="text-xs text-snack-muted mb-3">
        Permanently delete your account and all your data. This cannot be undone.
      </p>
      <button
        type="button"
        className="w-full text-sm py-2 px-4 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 transition font-medium"
        onClick={() => { setDeleteModalOpen(true); setDeletePassword(''); setDeleteError(null) }}
      >
        Delete my account
      </button>
    </div>
  )

  const statsSummaryCards = (
    <div className="grid grid-cols-2 gap-3 mb-6">
      <div className="card p-3 text-center">
        <p className="text-lg font-bold text-snack-text">{stats?.totalPosts ?? reviews.length}</p>
        <p className="text-xs text-snack-muted">Posts</p>
      </div>
      <div className="card p-3 text-center">
        <p className="text-lg font-bold text-snack-text">{stats?.totalLikesReceived ?? 0}</p>
        <p className="text-xs text-snack-muted">Likes received</p>
      </div>
    </div>
  )

  const achievementsPanel = (
    <div className="card p-4 mb-6">
      <h2 className="font-heading font-semibold text-snack-text mb-3">Achievements</h2>
      {earnedBadges.length === 0 && inProgressBadges.length === 0 ? (
        <p className="text-sm text-snack-muted">No achievement progress yet.</p>
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
  )

  const statsPanel = stats ? (
    <div className="card p-4 mb-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading font-semibold text-snack-text">My Stats</h2>
        <span className="text-xs text-snack-muted">
          Avg rating given {stats.averageOverallRatingGiven?.toFixed(1) ?? '—'}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-snack-muted">Unique locations</p>
          <p className="font-semibold text-snack-text">{stats.uniqueLocationsVisited}</p>
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
  ) : null

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-semibold text-snack-text">Log in to view your profile.</p>
        <a href="/auth/login" className="btn-primary mt-4 inline-block">Log in</a>
      </div>
    )
  }

  if (isMobileViewport === null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <div className="card h-28 animate-pulse bg-snack-surface" />
        <div className="card h-48 animate-pulse bg-snack-surface" />
      </div>
    )
  }

  // Mobile Layout
  if (isMobileViewport) {
    return (
      <div className="md:hidden flex min-h-full flex-col">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-snack-background border-b border-snack-border px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <AvatarLightbox
              avatarKey={meProfile?.avatarKey}
              username={meProfile?.username ?? user.username}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <h1 className="font-heading font-bold text-lg text-snack-text truncate flex items-center gap-1">
                {meProfile?.username ?? user.username}
                {meProfile?.isVerified && <VerifiedBadge className="w-4 h-4" />}
              </h1>
              <p className="text-xs text-snack-muted">@{meProfile?.username ?? user.username}</p>
              <p className="mt-1 text-xs text-snack-muted line-clamp-2">{meProfile?.bio?.trim() || 'Snack hunter & reviewer'}</p>
            </div>
            <button
              onClick={async () => { await logout(); router.push('/auth/login') }}
              className="btn-secondary text-xs py-1 px-2"
            >
              Log out
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-snack-border -mx-4 px-4 overflow-x-auto">
            {profileTabs.map((t) => (
              <Link
                key={t}
                href={`/profile?tab=${t}`}
                aria-current={tab === t ? 'page' : undefined}
                className={`py-2 px-3 text-sm font-medium whitespace-nowrap transition border-b-2 ${
                  tab === t
                    ? 'border-snack-primary text-snack-primary'
                    : 'border-transparent text-snack-muted hover:text-snack-text'
                }`}
              >
                {t === 'posts' ? 'Posts' : t === 'stats' ? 'Stats' : t === 'notifications' ? 'Notifications' : 'Settings'}
              </Link>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Posts Tab */}
          {tab === 'posts' && (
            <>
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
                  <a href="/add-review" className="btn-primary mt-4 inline-block">Add your first review</a>
                </div>
              )}

              <div className="space-y-4">
                {reviews.map((r) => (
                  <ReviewCard
                    key={r.id}
                    review={r}
                    photoVariantPreference={['large', 'medium', 'thumb']}
                    backContext="profile"
                  />
                ))}
              </div>
            </>
          )}

          {/* Notifications Tab */}
          {tab === 'notifications' && (
            <NotificationsList />
          )}

          {tab === 'stats' && (
            <div className="space-y-4">
              {statsSummaryCards}
              {statsPanel}
              {achievementsPanel}
            </div>
          )}

          {/* Settings Tab */}
          {tab === 'settings' && (
            <div className="space-y-4">
              {/* Profile Settings */}
              <div className="card p-4">
                <h3 className="font-heading font-semibold text-snack-text mb-3">Profile Settings</h3>
                <button
                  type="button"
                  className="btn-secondary w-full text-sm mb-3"
                  onClick={() => setIsEditingProfile((v) => !v)}
                >
                  {isEditingProfile ? 'Close' : 'Edit Profile'}
                </button>

                {isEditingProfile && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <label className="btn-secondary text-xs cursor-pointer">
                        {avatarUploading ? 'Uploading...' : 'Change picture'}
                        <input
                          type="file"
                          accept="image/*,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null
                            void handleAvatarUpload(file)
                            e.currentTarget.value = ''
                          }}
                          disabled={avatarUploading}
                        />
                      </label>
                    </div>

                    <div>
                      <label className="label text-xs">Username</label>
                      <input
                        className="input text-sm"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        minLength={3}
                        maxLength={30}
                        pattern="^[a-zA-Z0-9_]+$"
                        disabled={Boolean(meProfile && !meProfile.usernameCanChangeNow)}
                      />
                    </div>

                    <div>
                      <label className="label text-xs">Bio ({editBio.length}/280)</label>
                      <textarea
                        className="input min-h-[80px] resize-none text-sm"
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        maxLength={280}
                        placeholder="Tell people who you are"
                      />
                    </div>

                    {profileError && <p className="text-xs text-red-500">{profileError}</p>}
                    {profileMessage && <p className="text-xs text-green-600">{profileMessage}</p>}

                    <button className="btn-primary w-full text-sm" onClick={handleSaveProfile} disabled={profileSaving || avatarUploading}>
                      {profileSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              {/* Appearance */}
              <div className="card p-4">
                <h3 className="font-heading font-semibold text-snack-text mb-3">Appearance</h3>
                <ThemeSettings />
              </div>

              {/* Notification Preferences */}
              <div className="card p-4">
                <h3 className="font-heading font-semibold text-snack-text mb-3">Notification Preferences</h3>
                <NotificationSettings embedded />
              </div>

              {dangerZone}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Desktop Layout
  return (
    <div className="hidden md:block mx-auto max-w-2xl px-4 py-6 space-y-6">
      <div className="card p-6 flex items-center gap-4">
        <AvatarLightbox
          avatarKey={meProfile?.avatarKey}
          username={meProfile?.username ?? user.username}
          size="lg"
        />
        <div className="min-w-0">
          <h1 className="font-heading font-bold text-xl text-snack-text flex items-center gap-1.5">
            {meProfile?.username ?? user.username}
            {meProfile?.isVerified && <VerifiedBadge className="w-5 h-5" />}
          </h1>
          <p className="text-sm text-snack-muted">@{meProfile?.username ?? user.username}</p>
          <p className="text-xs text-snack-muted mt-1">{meProfile?.bio?.trim() || 'Snack hunter & reviewer'}</p>
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

      <div className="flex gap-2 border-b border-snack-border overflow-x-auto">
        {profileTabs.map((t) => (
          <Link
            key={t}
            href={`/profile?tab=${t}`}
            aria-current={tab === t ? 'page' : undefined}
            className={`py-3 px-4 text-sm font-medium whitespace-nowrap transition border-b-2 ${
              tab === t
                ? 'border-snack-primary text-snack-primary'
                : 'border-transparent text-snack-muted hover:text-snack-text'
            }`}
          >
            {t === 'posts' ? 'Posts' : t === 'stats' ? 'Stats' : t === 'notifications' ? 'Notifications' : 'Settings'}
          </Link>
        ))}
      </div>

      {tab === 'posts' && (
        <>
          <h2 className="font-heading font-semibold text-lg text-snack-text">My Posts</h2>

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
            {reviews.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                photoVariantPreference={['large', 'medium', 'thumb']}
                backContext="profile"
              />
            ))}
          </div>
        </>
      )}

      {tab === 'notifications' && (
        <>
          <h2 className="font-heading font-semibold text-lg text-snack-text">Notifications</h2>
          <NotificationsList />
        </>
      )}

      {tab === 'stats' && (
        <>
          <h2 className="font-heading font-semibold text-lg text-snack-text">My Stats</h2>
          {statsSummaryCards}
          {statsPanel}
          {achievementsPanel}
        </>
      )}

      {tab === 'settings' && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading font-semibold text-snack-text">Profile</h2>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setIsEditingProfile((v) => !v)}
            >
              {isEditingProfile ? 'Close' : 'Edit Profile'}
            </button>
          </div>

          {isEditingProfile && (
            <div className="card p-4 mb-6 space-y-3">
              <h3 className="font-heading font-semibold text-snack-text">Edit Profile</h3>

              <div className="flex items-center gap-3">
                <label className="btn-secondary text-sm cursor-pointer">
                  {avatarUploading ? 'Uploading...' : 'Change profile image'}
                  <input
                    type="file"
                    accept="image/*,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      void handleAvatarUpload(file)
                      e.currentTarget.value = ''
                    }}
                    disabled={avatarUploading}
                  />
                </label>
              </div>

              <div>
                <label className="label">Username</label>
                <input
                  className="input"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  minLength={3}
                  maxLength={30}
                  pattern="^[a-zA-Z0-9_]+$"
                  disabled={Boolean(meProfile && !meProfile.usernameCanChangeNow)}
                />
                <p className="mt-1 text-xs text-snack-muted">
                  {meProfile?.usernameCanChangeNow
                    ? 'You can change your username now.'
                    : meProfile?.nextUsernameChangeAt
                      ? `Username can be changed again after ${new Date(meProfile.nextUsernameChangeAt).toLocaleDateString()}.`
                      : 'Username can be changed once every 30 days.'}
                </p>
              </div>

              <div>
                <label className="label">Bio <span className="text-snack-muted font-normal">({editBio.length}/280)</span></label>
                <textarea
                  className="input min-h-[100px] resize-none"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  maxLength={280}
                  placeholder="Tell people who you are and what you love to eat."
                />
              </div>

              {profileError && <p className="text-sm text-red-500">{profileError}</p>}
              {profileMessage && <p className="text-sm text-green-600">{profileMessage}</p>}

              <button className="btn-primary" onClick={handleSaveProfile} disabled={profileSaving || avatarUploading}>
                {profileSaving ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          )}

          <div className="mb-6 flex flex-wrap gap-2">
            <Link href={`/u/${user.username}`} className="btn-secondary text-sm py-2">Public Profile</Link>
          </div>

          {stats && false && (
            <div className="card p-4 mb-6">
              <h2 className="font-heading font-semibold text-snack-text mb-3">My Stats</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-snack-muted">Unique locations</p>
                  <p className="font-semibold text-snack-text">{stats?.uniqueLocationsVisited ?? 0}</p>
                </div>
                <div>
                  <p className="text-snack-muted">Avg overall given</p>
                  <p className="font-semibold text-snack-text">{stats?.averageOverallRatingGiven?.toFixed(1) ?? '-'}</p>
                </div>
                <div>
                  <p className="text-snack-muted">Current streak</p>
                  <p className="font-semibold text-snack-text">{stats?.streak.current ?? 0} days</p>
                </div>
                <div>
                  <p className="text-snack-muted">Best streak</p>
                  <p className="font-semibold text-snack-text">{stats?.streak.best ?? 0} days</p>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-xs text-snack-muted mb-1">Last 8 weeks</p>
                <div className="flex items-end gap-1 h-12">
                  {(stats?.weeklyActivity ?? []).map((week) => (
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

          {false && (
            <div className="card p-4 mb-6">
              <h2 className="font-heading font-semibold text-snack-text mb-3">Achievements</h2>
            {earnedBadges.length === 0 && inProgressBadges.length === 0 ? (
              <p className="text-sm text-snack-muted">No achievement progress yet.</p>
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
          )}

          {selectedBadge && false && (
            <div className="fixed inset-0 z-50 bg-black/35 flex items-end sm:items-center justify-center p-4" onClick={() => setSelectedBadge(null)}>
              <div className="w-full max-w-sm card p-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-heading font-semibold text-snack-text">{selectedBadge?.badge.name}</h3>
                <p className="text-xs text-snack-muted mt-1">Tier: {selectedBadge?.badge.tier}</p>
                <p className="text-sm text-snack-muted mt-2">{selectedBadge?.badge.description}</p>
                <p className="text-sm text-snack-text mt-3">
                  Progress: {selectedBadge?.progressCurrent ?? 0}/{selectedBadge?.progressTarget ?? 0}
                </p>
                <button className="btn-secondary w-full mt-4" onClick={() => setSelectedBadge(null)}>Close</button>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h2 className="font-heading font-semibold text-lg text-snack-text mb-4">Appearance</h2>
            <ThemeSettings />
          </div>

          <div className="mb-6">
            <h2 className="font-heading font-semibold text-lg text-snack-text mb-4">Notification Settings</h2>
            <NotificationSettings embedded />
          </div>

          {dangerZone}
        </>
      )}

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

      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDeleteModalOpen(false)}>
          <div className="w-full max-w-sm card p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading font-semibold text-snack-text mb-1">Delete account</h3>
            <p className="text-sm text-snack-muted mb-4">
              This permanently deletes your account, reviews, and all associated data. Enter your password to confirm.
            </p>
            <input
              type="password"
              className="input mb-3"
              placeholder="Your password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoFocus
            />
            {deleteError && <p className="text-xs text-red-500 mb-3">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary flex-1 text-sm"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 text-sm py-2 px-4 rounded-xl bg-red-600 text-white hover:bg-red-700 transition font-medium disabled:opacity-50"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || !deletePassword}
              >
                {deleteLoading ? 'Deleting...' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="card h-32 animate-pulse bg-snack-surface" />
        <div className="card h-64 animate-pulse bg-snack-surface" />
        <div className="card h-48 animate-pulse bg-snack-surface" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  )
}
