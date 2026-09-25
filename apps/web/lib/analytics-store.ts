import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { AnalyticsEvent } from '@/lib/analytics-events'

/**
 * Daily counters in Redis: one hash per UTC day, one field per `event|source`.
 *
 * Redis rather than Postgres because this is write-heavy, loss-tolerant and needs no joins;
 * one HINCRBY per event costs next to nothing. Keys expire after ~13 months so a year-on-year
 * comparison stays possible without the data living forever.
 */
const KEY_PREFIX = 'analytics:day:'
const RETENTION_SECONDS = 400 * 24 * 60 * 60
const FIELD_SEPARATOR = '|'

export function dayKey(date: Date): string {
  return `${KEY_PREFIX}${date.toISOString().slice(0, 10)}`
}

export function counterField(event: AnalyticsEvent, source?: string): string {
  return source ? `${event}${FIELD_SEPARATOR}${source}` : event
}

/**
 * Best-effort: a failed counter must never fail the request that triggered it, so errors are
 * logged and swallowed here rather than at every call site.
 */
export async function recordEvent(event: AnalyticsEvent, source?: string): Promise<void> {
  const key = dayKey(new Date())
  try {
    await redis
      .multi()
      .hincrby(key, counterField(event, source), 1)
      .expire(key, RETENTION_SECONDS)
      .exec()
  } catch (error) {
    logger.warn({ err: error, event }, 'Failed to record analytics event')
  }
}

export interface DailyCounts {
  date: string
  counts: Record<string, number>
}

/** The last `days` days, oldest first, including today. Missing days come back empty. */
export async function getDailyCounts(days: number, now = new Date()): Promise<DailyCounts[]> {
  const dates: string[] = []
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(now)
    date.setUTCDate(date.getUTCDate() - offset)
    dates.push(date.toISOString().slice(0, 10))
  }

  const pipeline = redis.pipeline()
  for (const date of dates) pipeline.hgetall(`${KEY_PREFIX}${date}`)
  const results = (await pipeline.exec()) ?? []

  return dates.map((date, index) => {
    const raw = (results[index]?.[1] ?? {}) as Record<string, string>
    const counts: Record<string, number> = {}
    for (const [field, value] of Object.entries(raw)) counts[field] = Number.parseInt(value, 10) || 0
    return { date, counts }
  })
}

/** Folds `event|source` fields into per-event totals, e.g. for a funnel overview. */
export function totalsByEvent(days: DailyCounts[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const day of days) {
    for (const [field, value] of Object.entries(day.counts)) {
      const event = field.split(FIELD_SEPARATOR)[0]
      totals[event] = (totals[event] ?? 0) + value
    }
  }
  return totals
}
