'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'

interface LeaderboardRow {
  id: string
  username: string
  avatarKey: string | null
  weeklyXp: number
  isMe: boolean
  rank: number
}

/** Weekly XP leaderboard among the user and the people they follow. */
export function LeaderboardPanel() {
  const { user, accessToken, loading: authLoading } = useAuth()
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)

  useEffect(() => {
    if (authLoading || !user || !accessToken) return
    let cancelled = false
    fetch('/api/v1/leaderboard', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((json) => {
        if (!cancelled) setRows(json.data?.data ?? [])
      })
      .catch(() => undefined) // panel is progressive enhancement
    return () => { cancelled = true }
  }, [user, accessToken, authLoading])

  if (!rows || rows.length === 0) return null

  return (
    <div className="card p-4 mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-heading font-semibold text-snack-text">This week</h2>
        <span className="text-xs text-snack-muted">XP · resets Monday</span>
      </div>
      {rows.length === 1 ? (
        <p className="text-sm text-snack-muted">
          Follow other spotters to turn this into a friendly race.{' '}
          <Link href="/search" className="font-medium text-snack-primary hover:underline">
            Find people
          </Link>
        </p>
      ) : (
        <ol className="space-y-1.5">
          {rows.slice(0, 8).map((row) => (
            <li
              key={row.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                row.isMe ? 'bg-snack-primary/10 border border-snack-primary/30' : 'bg-snack-surface'
              }`}
            >
              <span className="w-5 text-sm font-bold text-snack-muted">{row.rank}</span>
              {row.isMe ? (
                <span className="flex-1 truncate text-sm font-semibold text-snack-text">You</span>
              ) : (
                <Link
                  href={`/u/${encodeURIComponent(row.username)}`}
                  className="flex-1 truncate text-sm font-medium text-snack-text hover:text-snack-primary"
                >
                  @{row.username}
                </Link>
              )}
              <span className="text-sm font-semibold text-snack-text">{row.weeklyXp} XP</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
