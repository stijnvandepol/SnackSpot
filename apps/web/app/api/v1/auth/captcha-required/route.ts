import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, parseQuery, serverError, isResponse } from '@/lib/api-helpers'
import { getClientIP, rateLimitIP, getLoginFailureCount } from '@/lib/rate-limit'

const QuerySchema = z.object({
  email: z.string().email().optional(),
})

const CAPTCHA_THRESHOLD = 3

export async function GET(req: NextRequest) {
  const ip = getClientIP(req)

  // Light rate-limit prevents using this endpoint as an oracle to discover
  // which accounts or IPs have been attacked.
  const rl = await rateLimitIP(ip, 'captcha_status', 60, 60)
  if (!rl.allowed) return ok({ captchaRequired: false })

  const query = parseQuery(req, QuerySchema)
  if (isResponse(query)) return ok({ captchaRequired: false })

  try {
    // When email is absent the email counter defaults to 0 (correct: a blank
    // email is never stored as a failure key).
    const failures = await getLoginFailureCount(ip, query.email ?? '')
    const captchaRequired =
      failures.ip >= CAPTCHA_THRESHOLD || failures.email >= CAPTCHA_THRESHOLD

    return ok({ captchaRequired })
  } catch (e) {
    return serverError('captcha-required', e)
  }
}
