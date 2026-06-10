import { describe, it, expect } from 'vitest'
import { computeStreaks } from './streaks'

function dayKey(offsetDays: number): string {
  const d = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

describe('computeStreaks', () => {
  it('returns zeros without activity', () => {
    expect(computeStreaks([])).toEqual({ current: 0, best: 0 })
  })

  it('counts a streak ending today', () => {
    const { current, best } = computeStreaks([dayKey(2), dayKey(1), dayKey(0)])
    expect(current).toBe(3)
    expect(best).toBe(3)
  })

  it('keeps the streak alive until the end of today when yesterday was active', () => {
    // Posted the last three days but not (yet) today: streak still shows 3.
    const { current } = computeStreaks([dayKey(3), dayKey(2), dayKey(1)])
    expect(current).toBe(3)
  })

  it('resets the current streak after a missed day', () => {
    const { current, best } = computeStreaks([dayKey(5), dayKey(4), dayKey(3)])
    expect(current).toBe(0)
    expect(best).toBe(3)
  })

  it('deduplicates multiple posts on the same day', () => {
    const { current } = computeStreaks([dayKey(1), dayKey(1), dayKey(0), dayKey(0)])
    expect(current).toBe(2)
  })

  it('tracks the best streak independently of the current one', () => {
    const { current, best } = computeStreaks([
      dayKey(10), dayKey(9), dayKey(8), dayKey(7), // best: 4
      dayKey(1), dayKey(0), // current: 2
    ])
    expect(best).toBe(4)
    expect(current).toBe(2)
  })
})
