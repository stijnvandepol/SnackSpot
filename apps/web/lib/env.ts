import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1).default('snackspot'),
  MINIO_PUBLIC_URL: z.string().url(),
  MINIO_REGION: z.string().min(1).default('us-east-1'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
  AUTH_COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === undefined ? undefined : v === 'true'),

  NEXT_PUBLIC_APP_URL: z.string().url().default('https://snackspot.online'),

  // Email (Resend)
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().default('SnackSpot <noreply@snackspot.online>'),

  CORS_ORIGINS: z.string().default('https://snackspot.online'),
  ALLOWED_HOSTS: z.string().optional(),
  MAX_JSON_BODY_BYTES: z.coerce.number().int().positive().default(256 * 1024),

  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  MAX_PHOTOS_PER_REVIEW: z.coerce.number().int().positive().default(5),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),

  // Web Push (VAPID) — required when sending browser push notifications.
  // Generate with: npx web-push generate-vapid-keys
  // VAPID_PUBLIC_KEY is also exposed client-side (safe — it is a public key).
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  // Typically a mailto: URL or your app's URL, identifies your server to push services.
  VAPID_SUBJECT: z.string().optional(),
})

const _env = envSchema.safeParse(process.env)

if (!_env.success) {
  const fieldErrors = _env.error.flatten().fieldErrors
  const failedVars = Object.keys(fieldErrors).join(', ')
  // eslint-disable-next-line no-console -- startup validation must be visible before logger is available
  console.error(`Invalid environment variables (${failedVars}):`, JSON.stringify(fieldErrors, null, 2))
  // Only throw at runtime, not during Next.js build analysis
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`Invalid environment variables: ${failedVars} – check .env`)
  }
}

export const env = _env.success ? _env.data : ({} as z.infer<typeof envSchema>)
