'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'

interface PassportItem {
  key: string
  name: string
  description: string
  icon: string
  earned: boolean
  earnedAt: string | null
}

interface PassportSet {
  key: string
  title: string
  earnedCount: number
  totalCount: number
  items: PassportItem[]
}

/** The Food Passport: stamp grids per set; unearned stamps show as silhouettes. */
export function PassportPanel() {
  const { user, accessToken, loading: authLoading } = useAuth()
  const [sets, setSets] = useState<PassportSet[] | null>(null)

  useEffect(() => {
    if (authLoading || !user || !accessToken) return
    let cancelled = false
    fetch('/api/v1/me/collectibles', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((json) => {
        if (!cancelled) setSets(json.data?.data ?? [])
      })
      .catch(() => undefined) // panel is progressive enhancement
    return () => { cancelled = true }
  }, [user, accessToken, authLoading])

  if (!sets || sets.length === 0) return null

  return (
    <div className="card p-4 mb-6">
      <h2 className="font-heading font-semibold text-snack-text mb-1">Food Passport</h2>
      <p className="text-xs text-snack-muted mb-4">
        Collect stamps by reviewing dishes, spots and cities.
      </p>
      <div className="space-y-5">
        {sets.map((set) => (
          <div key={set.key}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-snack-text">{set.title}</h3>
              <span className="text-xs text-snack-muted">
                {set.earnedCount}/{set.totalCount}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {set.items.map((item) => (
                <div
                  key={item.key}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl border p-1 text-center ${
                    item.earned
                      ? 'border-snack-primary/40 bg-snack-primary/10'
                      : 'border-dashed border-snack-border bg-snack-surface opacity-50'
                  }`}
                  title={`${item.name}, ${item.description}`}
                >
                  <span
                    className={`text-xl ${item.earned ? '' : 'grayscale'}`}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <span className="mt-0.5 w-full truncate text-[10px] font-medium leading-tight text-snack-muted">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
