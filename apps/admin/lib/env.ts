import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  // The admin issues fixed 8-hour access tokens (see ADMIN_SESSION_HOURS in auth.ts)
  // and does not use refresh-token rotation, so JWT_REFRESH_EXPIRES_DAYS/IN is not needed here.
  ADMIN_TOKEN: z.string().min(32).optional(),
  AUTH_COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().default('SnackSpot <noreply@snackspot.online>'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors
  const failedVars = Object.keys(fieldErrors).join(', ')
  // eslint-disable-next-line no-console -- startup validation must be visible before logger is available
  console.error(`Invalid environment variables (${failedVars}):`, JSON.stringify(fieldErrors, null, 2))
  // Only throw at runtime, not during Next.js build analysis
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`Invalid environment variables: ${failedVars} – check .env`)
  }
}

export const env = parsed.success ? parsed.data : ({} as z.infer<typeof envSchema>)
