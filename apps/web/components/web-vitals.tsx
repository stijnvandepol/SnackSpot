'use client'
import { useReportWebVitals } from 'next/web-vitals'
import { track } from '@/lib/analytics'

/** Core Web Vitals we act on. FCP/TTFB are diagnostic and would only add noise to the counts. */
const REPORTED_METRICS = new Set(['LCP', 'INP', 'CLS'])

/**
 * Field data for Core Web Vitals, bucketed by Google's own thresholds (good / needs-improvement
 * / poor). The admin dashboard shows the share of "good" per metric — the same pass/fail view
 * Search Console uses, from real visitors instead of a lab run.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    if (!REPORTED_METRICS.has(metric.name)) return
    track('web_vital', { source: `${metric.name}:${metric.rating}` })
  })
  return null
}
