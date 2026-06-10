'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'

interface Quest {
  id: string
  title: string
  description: string
  progress: number
  target: number
  rewardXp: number
  completed: boolean
}

/** Compact "today's quests" card above the feed — the daily reason to open the app. */
const COLLAPSE_STORAGE_KEY = 'snackspot.quests.collapsed'

export function DailyQuestsStrip() {
  const { user, accessToken, loading: authLoading } = useAuth()
  const [quests, setQuests] = useState<Quest[] | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  // Respect the user's choice: once collapsed, the strip stays collapsed
  // across visits instead of demanding attention every day.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1')
    } catch {
      // storage unavailable (private mode): default to expanded
    }
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, current ? '0' : '1')
      } catch {
        // best-effort persistence
      }
      return !current
    })
  }

  useEffect(() => {
    if (authLoading || !user || !accessToken) return
    let cancelled = false
    fetch('/api/v1/me/quests', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((json) => {
        if (!cancelled) setQuests(json.data?.data ?? [])
      })
      .catch(() => undefined) // the strip is progressive enhancement
    return () => { cancelled = true }
  }, [user, accessToken, authLoading])

  if (!user || !quests || quests.length === 0) return null

  const doneCount = quests.filter((q) => q.completed).length
  const allDone = doneCount === quests.length

  return (
    <div className="card mb-4 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
      >
        <p className="font-heading font-semibold text-snack-text">
          {allDone ? 'All quests done today 🎉' : "Today's quests"}
        </p>
        <span className="text-xs font-medium text-snack-muted">
          {doneCount}/{quests.length} {collapsed ? '▸' : '▾'}
        </span>
      </button>

      {!collapsed && (
        <ul className="mt-3 space-y-2">
          {quests.map((q) => (
            <li
              key={q.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                q.completed ? 'bg-snack-surface opacity-70' : 'bg-snack-surface'
              }`}
            >
              <span className="text-lg" aria-hidden="true">{q.completed ? '✅' : '◻️'}</span>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${q.completed ? 'text-snack-muted line-through' : 'text-snack-text'}`}>
                  {q.title}
                </p>
                {!q.completed && q.target > 1 && (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-snack-border/50">
                    <div
                      className="h-full rounded-full bg-snack-primary"
                      style={{ width: `${Math.min(100, Math.round((q.progress / q.target) * 100))}%` }}
                    />
                  </div>
                )}
              </div>
              <span className="flex-shrink-0 rounded-full bg-snack-primary/10 px-2 py-0.5 text-xs font-semibold text-snack-primary">
                {q.target > 1 ? `${Math.min(q.progress, q.target)}/${q.target} · ` : ''}+{q.rewardXp} XP
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
