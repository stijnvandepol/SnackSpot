import { type NextRequest } from 'next/server'
import { TrackEventSchema } from '@/lib/analytics-events'
import { recordEvent } from '@/lib/analytics-store'
import { err, isResponse, noContent, parseBody, requireSameOrigin } from '@/lib/api-helpers'
import { getClientIP, rateLimitIP } from '@/lib/rate-limit'

/**
 * Anonymous funnel counter. Accepts only allowlisted event names (lib/analytics-events.ts)
 * and stores a daily count — no identifier of the caller is persisted. The IP is used for
 * the rate-limit window only, which Redis expires on its own.
 */
export async function POST(req: NextRequest) {
  const sameOrigin = requireSameOrigin(req)
  if (isResponse(sameOrigin)) return sameOrigin

  // Generous for a real visitor (a busy session sends a few dozen), tight for a script.
  const rl = await rateLimitIP(getClientIP(req), 'analytics_event', 120, 60)
  if (!rl.allowed) return err('Je gaat even te snel. Probeer het zo opnieuw.', 429)

  const body = await parseBody(req, TrackEventSchema)
  if (isResponse(body)) return body

  await recordEvent(body.event, body.source)
  return noContent()
}
