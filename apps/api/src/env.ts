const required = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'CSRF_SECRET',
  'CORS_ORIGIN',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'S3_BUCKET'
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing env var: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT_API ?? 4000),
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  accessSecret: process.env.JWT_ACCESS_SECRET!,
  refreshSecret: process.env.JWT_REFRESH_SECRET!,
  accessTtl: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
  refreshTtl: Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 1209600),
  csrfSecret: process.env.CSRF_SECRET!,
  corsOrigin: process.env.CORS_ORIGIN!,
  s3Endpoint: process.env.S3_ENDPOINT!,
  s3Region: process.env.S3_REGION!,
  s3AccessKey: process.env.S3_ACCESS_KEY!,
  s3SecretKey: process.env.S3_SECRET_KEY!,
  s3Bucket: process.env.S3_BUCKET!,
  uploadMaxBytes: Number(process.env.UPLOAD_MAX_BYTES ?? 8 * 1024 * 1024),
  defaultRadiusMeters: Number(process.env.DEFAULT_RADIUS_METERS ?? 3000),
  maxRadiusMeters: Number(process.env.MAX_RADIUS_METERS ?? 25000)
};
