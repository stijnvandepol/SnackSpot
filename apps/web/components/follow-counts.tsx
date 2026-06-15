'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { FollowListModal, type FollowListType } from '@/components/follow-list-modal'

interface Counts {
  followerCount: number
  followingCount: number
}

/**
 * Read-only follower/following counts that open the followers/following list
 * on click. Used on the user's own profile, where FollowButton is not shown.
 */
export function FollowCounts({ username }: { username: string }) {
  const { accessToken, loading: authLoading } = useAuth()
  const [counts, setCounts] = useState<Counts | null>(null)
  const [openList, setOpenList] = useState<FollowListType | null>(null)

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    fetch(`/api/v1/users/${encodeURIComponent(username)}/follow`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((json) => {
        if (!cancelled) setCounts(json.data)
      })
      .catch(() => undefined) // counts are progressive enhancement
    return () => {
      cancelled = true
    }
  }, [username, accessToken, authLoading])

  if (!counts) return null

  return (
    <p className="text-sm text-snack-muted">
      <button type="button" onClick={() => setOpenList('followers')} className="hover:underline">
        <span className="font-semibold text-snack-text">{counts.followerCount}</span> follower
        {counts.followerCount === 1 ? '' : 's'}
      </button>
      <span className="mx-1.5">·</span>
      <button type="button" onClick={() => setOpenList('following')} className="hover:underline">
        <span className="font-semibold text-snack-text">{counts.followingCount}</span> following
      </button>
      {openList && (
        <FollowListModal username={username} type={openList} onClose={() => setOpenList(null)} />
      )}
    </p>
  )
}
