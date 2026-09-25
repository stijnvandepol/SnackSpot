import type { AnalyticsEvent } from '@/lib/analytics-events'

/**
 * Client-side counter ping. Fire-and-forget: `sendBeacon` survives the page navigating away
 * (which is exactly when "cta_register_click" fires), and nothing awaits it.
 *
 * Sends only the event name and a coarse source label — see lib/analytics-events.ts for why.
 */
export function track(event: AnalyticsEvent, props?: { source?: string }): void {
  if (typeof window === 'undefined') return
  try {
    const body = JSON.stringify({ event, ...(props?.source ? { source: props.source } : {}) })
    const blob = new Blob([body], { type: 'application/json' })
    if (navigator.sendBeacon?.('/api/v1/events', blob)) return
    void fetch('/api/v1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined) // measurement is best-effort; never surface it to the user
  } catch {
    // Blob/sendBeacon unavailable (very old browser, test env): skip silently.
  }
}
