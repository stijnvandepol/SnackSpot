'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { Modal } from '@/components/ui/modal'
import { VerifiedBadge } from '@/components/verified-badge'
import { avatarUrl } from '@/lib/avatar'

export type FollowListType = 'followers' | 'following'

interface FollowUser {
  username: string
  avatarKey: string | null
  isVerified: boolean
  bio: string | null
  viewerFollows: boolean
}

interface FollowListModalProps {
  username: string
  type: FollowListType
  onClose: () => void
}

const TITLES: Record<FollowListType, string> = {
  followers: 'Followers',
  following: 'Following',
}

const EMPTY: Record<FollowListType, string> = {
  followers: 'No followers yet.',
  following: 'Not following anyone yet.',
}

/**
 * Lists a profile's followers or who they follow, with cursor paging.
 * Built on the shared Modal so it inherits the app's mobile-correct chrome
 * (centered, edge padding, scroll lock, focus trap, ESC/backdrop close).
 */
export function FollowListModal({ username, type, onClose }: FollowListModalProps) {
  const { accessToken } = useAuth()
  const [users, setUsers] = useState<FollowUser[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const loadedOnce = useRef(false)

  const load = useCallback(
    async (nextCursor: string | null) => {
      setLoading(true)
      setError(false)
      try {
        const params = new URLSearchParams({ limit: '20' })
        if (nextCursor) params.set('cursor', nextCursor)
        const res = await fetch(
          `/api/v1/users/${encodeURIComponent(username)}/${type}?${params.toString()}`,
          { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined },
        )
        if (!res.ok) throw new Error('failed')
        const json = await res.json()
        const page = json.data as { data: FollowUser[]; pagination: { nextCursor: string | null; hasMore: boolean } }
        setUsers((prev) => (nextCursor ? [...prev, ...page.data] : page.data))
        setCursor(page.pagination.nextCursor)
        setHasMore(page.pagination.hasMore)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    },
    [username, type, accessToken],
  )

  // Initial load — guard against double-invocation in React Strict Mode.
  useEffect(() => {
    if (loadedOnce.current) return
    loadedOnce.current = true
    load(null)
  }, [load])

  return (
    <Modal open onClose={onClose} title={TITLES[type]}>
      <div className="-mx-2 mt-2 max-h-[60vh] overflow-y-auto">
        {users.map((u) => (
          <Link
            key={u.username}
            href={`/u/${encodeURIComponent(u.username)}`}
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-snack-surface"
          >
            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-snack-surface flex items-center justify-center text-snack-primary font-semibold uppercase">
              {u.avatarKey ? (
                <Image
                  src={avatarUrl(u.avatarKey) as string}
                  alt={u.username}
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                />
              ) : (
                u.username.charAt(0)
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-sm font-medium text-snack-text">
                <span className="truncate">{u.username}</span>
                {u.isVerified && <VerifiedBadge className="h-4 w-4 shrink-0" />}
              </span>
              {u.bio?.trim() && (
                <span className="block truncate text-xs text-snack-muted">{u.bio.trim()}</span>
              )}
            </span>
          </Link>
        ))}

        {!loading && !error && users.length === 0 && (
          <p className="p-6 text-center text-sm text-snack-muted">{EMPTY[type]}</p>
        )}

        {error && (
          <div className="p-6 text-center">
            <p className="text-sm text-snack-muted">Could not load this list.</p>
            <button type="button" onClick={() => load(cursor)} className="btn-secondary mt-3 text-sm">
              Try again
            </button>
          </div>
        )}

        {loading && <p className="p-6 text-center text-sm text-snack-muted">Loading...</p>}

        {!loading && hasMore && (
          <button
            type="button"
            onClick={() => load(cursor)}
            className="btn-secondary mx-auto my-2 block text-sm"
          >
            Load more
          </button>
        )}
      </div>
    </Modal>
  )
}
