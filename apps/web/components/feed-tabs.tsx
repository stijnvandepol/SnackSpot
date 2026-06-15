'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FeedClient } from '@/components/feed-client'
import { useAuth } from '@/components/auth-provider'
import { photoVariantUrl } from '@/lib/photo-url'
import { mealEmoji } from '@/lib/meal'
import { BiteLightbox } from '@/components/bite-lightbox'

type Scope = 'discover' | 'following'

interface FriendBite {
  id: string
  mealSlot: string
  note: string | null
  createdAt: string
  user: { id: string; username: string; avatarKey: string | null }
  photo: { id: string; variants: Record<string, string> }
  place: { id: string; name: string } | null
}

/** Horizontal strip of the last 24h of bites from mutual follows. Exported for tests. */
export function FriendsBitesStrip() {
  const { user, accessToken } = useAuth()
  const [bites, setBites] = useState<FriendBite[]>([])
  const [selected, setSelected] = useState<FriendBite | null>(null)

  useEffect(() => {
    if (!user || !accessToken) return
    let cancelled = false
    fetch('/api/v1/me/friends-bites', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((json) => {
        if (!cancelled) setBites(json.data?.data ?? [])
      })
      .catch(() => undefined) // best-effort strip; the feed below still works
    return () => { cancelled = true }
  }, [user, accessToken])

  if (bites.length === 0) return null

  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-snack-muted">
        Bites from your circle, last 24h
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {bites.map((b) => {
          const src = photoVariantUrl(b.photo.variants, ['thumb', 'medium', 'large'])
          return (
            <div key={b.id} className="w-20 flex-shrink-0 text-center">
              {src ? (
                <button
                  type="button"
                  onClick={() => setSelected(b)}
                  className="relative mx-auto block h-20 w-20 cursor-zoom-in overflow-hidden rounded-2xl bg-snack-surface focus:outline-none focus:ring-2 focus:ring-snack-primary"
                  aria-label={`View ${b.user.username}'s bite photo`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  <span className="absolute bottom-1 right-1 text-sm" aria-hidden="true">
                    {mealEmoji(b.mealSlot)}
                  </span>
                </button>
              ) : (
                // No usable photo variant (e.g. still processing): nothing to zoom.
                <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-2xl bg-snack-surface">
                  <span className="absolute bottom-1 right-1 text-sm" aria-hidden="true">
                    {mealEmoji(b.mealSlot)}
                  </span>
                </div>
              )}
              <Link
                href={`/u/${encodeURIComponent(b.user.username)}`}
                className="mt-1 block truncate text-xs text-snack-muted hover:text-snack-primary"
              >
                @{b.user.username}
              </Link>
            </div>
          )
        })}
      </div>
      <BiteLightbox bite={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

export function FeedTabs() {
  const { user } = useAuth()
  const [scope, setScope] = useState<Scope>('discover')

  // Anonymous visitors only have the public discover feed.
  if (!user) return <FeedClient scope="discover" />

  return (
    <>
      <div className="mb-4 flex gap-1 rounded-xl bg-snack-surface p-1" role="tablist" aria-label="Feed scope">
        {([
          ['following', 'Following'],
          ['discover', 'Discover'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={scope === value}
            onClick={() => setScope(value)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              scope === value ? 'bg-snack-background text-snack-primary shadow-sm' : 'text-snack-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {scope === 'following' && <FriendsBitesStrip />}

      {/* key resets pagination state when switching tabs */}
      <FeedClient key={scope} scope={scope} />
    </>
  )
}
