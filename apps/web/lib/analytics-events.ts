import { z } from 'zod'

/**
 * The funnel, as a closed list.
 *
 * SnackSpot measures *how often* each step happens per day — nothing about *who*. No user id,
 * no IP, no cookie, no URL beyond a coarse `source` label. That keeps the measurement outside
 * the consent requirement for tracking (and inside the promise on /privacy), at the price of
 * not being able to follow one person through the funnel. For a site this size, daily step
 * counts answer the questions that matter: where do people drop out, and did a change help.
 *
 * Adding an event means adding it here; anything else is rejected at the boundary so the
 * endpoint cannot be turned into a free-form key/value store.
 */
export const ANALYTICS_EVENTS = [
  // Acquisition → activation
  'signup_view',
  'signup_completed', // server-side
  'login_completed', // server-side
  'cta_register_click',
  // Discovery
  'search_performed',
  'nearby_used',
  'place_view',
  'dish_page_view',
  'city_page_view',
  // Contribution
  'review_started',
  'review_created', // server-side
  'first_review_created', // server-side
  // Retention / virality
  'place_saved',
  'share_clicked',
  'report_submitted',
  // Performance (source = "<metric>:<rating>", e.g. "LCP:good")
  'web_vital',
] as const

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number]

/** Coarse label: a-z, digits, `_ - :`, short. Enough for "home", "place_page", "LCP:poor". */
const SOURCE_PATTERN = /^[a-zA-Z0-9_:-]{1,40}$/

export const TrackEventSchema = z.object({
  event: z.enum(ANALYTICS_EVENTS),
  source: z.string().regex(SOURCE_PATTERN).optional(),
})

export type TrackEventInput = z.infer<typeof TrackEventSchema>

/** Normalises a source label, or returns undefined when it would be rejected. */
export function normaliseSource(source: string | null | undefined): string | undefined {
  if (!source) return undefined
  return SOURCE_PATTERN.test(source) ? source : undefined
}
