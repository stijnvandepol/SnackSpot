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

  CORS_ORIGINS: z.string().default('http://localhost:8080'),

  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  MAX_PHOTOS_PER_REVIEW: z.coerce.number().int().positive().default(5),
})

const _env = envSchema.safeParse(process.env)

if (!_env.success) {
  console.error('❌ Invalid environment variables:')
  console.error(JSON.stringify(_env.error.flatten().fieldErrors, null, 2))
  // Only throw at runtime, not during Next.js build analysis
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Invalid environment variables – check .env')
  }
}

export const env = _env.success ? _env.data : ({} as z.infer<typeof envSchema>)
