import { beforeEach, describe, expect, it, vi } from 'vitest'

const hashes = new Map<string, Record<string, string>>()

vi.mock('@/lib/redis', () => {
  const multi = () => {
    const ops: Array<() => void> = []
    const chain = {
      hincrby(key: string, field: string, by: number) {
        ops.push(() => {
          const hash = hashes.get(key) ?? {}
          hash[field] = String(Number(hash[field] ?? 0) + by)
          hashes.set(key, hash)
        })
        return chain
      },
      expire() {
        return chain
      },
      async exec() {
        ops.forEach((op) => op())
        return []
      },
    }
    return chain
  }
  const pipeline = () => {
    const keys: string[] = []
    const chain = {
      hgetall(key: string) {
        keys.push(key)
        return chain
      },
      async exec() {
        return keys.map((key) => [null, hashes.get(key) ?? {}])
      },
    }
    return chain
  }
  return { redis: { multi, pipeline } }
})

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import { TrackEventSchema, normaliseSource } from './analytics-events'
import { counterField, dayKey, getDailyCounts, recordEvent, totalsByEvent } from './analytics-store'

describe('TrackEventSchema', () => {
  it('accepts allowlisted events with a coarse source', () => {
    expect(TrackEventSchema.safeParse({ event: 'web_vital', source: 'LCP:good' }).success).toBe(true)
    expect(TrackEventSchema.safeParse({ event: 'place_view' }).success).toBe(true)
  })

  it('rejects unknown events and free-form sources', () => {
    expect(TrackEventSchema.safeParse({ event: 'anything' }).success).toBe(false)
    expect(TrackEventSchema.safeParse({ event: 'place_view', source: 'https://x.y/z' }).success).toBe(false)
    expect(TrackEventSchema.safeParse({ event: 'place_view', source: 'a'.repeat(41) }).success).toBe(false)
  })

  it('normaliseSource drops invalid labels', () => {
    expect(normaliseSource('feed')).toBe('feed')
    expect(normaliseSource('user@example.com')).toBeUndefined()
    expect(normaliseSource(null)).toBeUndefined()
  })
})

describe('analytics store', () => {
  beforeEach(() => hashes.clear())

  it('builds day keys and fields', () => {
    expect(dayKey(new Date('2026-09-25T23:59:00Z'))).toBe('analytics:day:2026-09-25')
    expect(counterField('place_view')).toBe('place_view')
    expect(counterField('place_view', 'feed')).toBe('place_view|feed')
  })

  it('counts events per day and folds sources into totals', async () => {
    await recordEvent('place_view', 'feed')
    await recordEvent('place_view', 'search')
    await recordEvent('place_view')
    await recordEvent('signup_completed', 'email')

    const days = await getDailyCounts(3)
    expect(days).toHaveLength(3)
    expect(days[2].counts['place_view|feed']).toBe(1)
    expect(days[0].counts).toEqual({})

    expect(totalsByEvent(days)).toEqual({ place_view: 3, signup_completed: 1 })
  })

  it('returns days oldest first, ending today', async () => {
    const days = await getDailyCounts(2, new Date('2026-03-01T12:00:00Z'))
    expect(days.map((d) => d.date)).toEqual(['2026-02-28', '2026-03-01'])
  })
})
