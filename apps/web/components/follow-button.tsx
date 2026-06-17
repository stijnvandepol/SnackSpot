'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { FollowListModal, type FollowListType } from '@/components/follow-list-modal'

interface FollowState {
  following: boolean
  followsMe: boolean
  followerCount: number
  followingCount: number
}

/** Follow/unfollow button + counts for a public profile. Hidden on own profile. */
export function FollowButton({ username }: { username: string }) {
  const { user, accessToken, loading: authLoading } = useAuth()
  const [state, setState] = useState<FollowState | null>(null)
  const [busy, setBusy] = useState(false)
  const [openList, setOpenList] = useState<FollowListType | null>(null)

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    fetch(`/api/v1/users/${encodeURIComponent(username)}/follow`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((json) => {
        if (!cancelled) setState(json.data)
      })
      .catch(() => undefined) // counts are progressive enhancement
    return () => { cancelled = true }
  }, [username, accessToken, authLoading])

  const toggle = async () => {
    if (!state || !accessToken || busy) return
    setBusy(true)
    // Optimistic flip; reconciled with the server response below.
    const wasFollowing = state.following
    setState({
      ...state,
      following: !wasFollowing,
      followerCount: state.followerCount + (wasFollowing ? -1 : 1),
    })
    try {
      const res = await fetch(`/api/v1/users/${encodeURIComponent(username)}/follow`, {
        method: wasFollowing ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error('failed')
      const json = await res.json()
      setState((prev) =>
        prev ? { ...prev, following: json.data.following, followerCount: json.data.followerCount } : prev,
      )
    } catch {
      // Roll back the optimistic update.
      setState((prev) =>
        prev
          ? { ...prev, following: wasFollowing, followerCount: state.followerCount }
          : prev,
      )
    } finally {
      setBusy(false)
    }
  }

  const isOwnProfile = user?.username?.toLowerCase() === username.toLowerCase()

  return (
    <div className="flex items-center gap-4">
      {state && (
        <p className="text-sm text-snack-muted">
          <button
            type="button"
            onClick={() => setOpenList('followers')}
            className="hover:underline"
          >
            <span className="font-semibold text-snack-text">{state.followerCount}</span> follower
            {state.followerCount === 1 ? '' : 's'}
          </button>
          <span className="mx-1.5">·</span>
          <button
            type="button"
            onClick={() => setOpenList('following')}
            className="hover:underline"
          >
            <span className="font-semibold text-snack-text">{state.followingCount}</span> following
          </button>
        </p>
      )}
      {openList && (
        <FollowListModal username={username} type={openList} onClose={() => setOpenList(null)} />
      )}
      {user && !isOwnProfile && state && (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={state.following ? 'btn-secondary text-sm' : 'btn-primary text-sm'}
        >
          {state.following ? 'Following' : state.followsMe ? 'Follow back' : 'Follow'}
        </button>
      )}
    </div>
  )
}
