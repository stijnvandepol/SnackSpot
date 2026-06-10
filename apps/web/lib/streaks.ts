// Pure streak math — no database imports so it stays unit-testable.

export function toDateKey(value: Date): string {
  const y = value.getUTCFullYear()
  const m = String(value.getUTCMonth() + 1).padStart(2, '0')
  const d = String(value.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function computeStreaks(dateKeys: string[]): { current: number; best: number } {
  if (dateKeys.length === 0) return { current: 0, best: 0 }

  const sorted = [...dateKeys].sort()
  let best = 1
  let running = 1

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00.000Z`)
    const curr = new Date(`${sorted[i]}T00:00:00.000Z`)
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000))
    if (diffDays === 1) {
      running += 1
      best = Math.max(best, running)
    } else {
      running = 1
    }
  }

  const uniqueSet = new Set(sorted)
  const today = new Date()
  let cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  // A streak stays alive until the end of today: posting yesterday but not
  // (yet) today still shows the running streak, so "post today to keep it
  // going" is true rather than punishing the user at midnight.
  if (!uniqueSet.has(toDateKey(cursor))) {
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000)
  }
  let current = 0
  while (uniqueSet.has(toDateKey(cursor))) {
    current += 1
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000)
  }

  return { current, best }
}
