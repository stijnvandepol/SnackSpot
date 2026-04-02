import { env } from './env'
import { logger } from './logger'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Verifies a Cloudflare Turnstile token server-side via the siteverify API.
 *
 * Returns false on any failure (network error, invalid token, timeout-or-duplicate).
 * Each token is single-use — replaying a token returns `timeout-or-duplicate`.
 *
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation
 */
export async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip,
      }),
    })

    if (!res.ok) {
      logger.warn({ status: res.status }, 'Turnstile siteverify returned non-200')
      return false
    }

    const data = await res.json() as { success: boolean; 'error-codes': string[] }
    if (!data.success) {
      logger.debug({ errorCodes: data['error-codes'] }, 'Turnstile token rejected')
    }
    return data.success === true
  } catch (err) {
    logger.error({ err }, 'Turnstile siteverify request failed')
    return false
  }
}
