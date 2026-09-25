'use client'
import { useEffect } from 'react'
import { track } from '@/lib/analytics'
import type { AnalyticsEvent } from '@/lib/analytics-events'

/**
 * Counts one view of a server-rendered page. Client-side on purpose: a server-side count would
 * include every crawler hit, which on a site this small would drown out real visitors.
 */
export function TrackView({ event, source }: { event: AnalyticsEvent; source?: string }) {
  useEffect(() => {
    track(event, source ? { source } : undefined)
  }, [event, source])
  return null
}
