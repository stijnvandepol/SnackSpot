import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',

  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: process.env.MINIO_ENDPOINT ?? 'localhost',
        port: process.env.MINIO_PORT ?? '9000',
        pathname: `/${process.env.MINIO_BUCKET ?? 'snackspot'}/**`,
      },
      // If MinIO is behind nginx in prod, add the public domain here too
    ],
  },

  // Security headers
  async headers() {
    const isProd = process.env.NODE_ENV === 'production'
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-eval needed by Next.js dev
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: http://${process.env.MINIO_ENDPOINT ?? 'localhost'}:${process.env.MINIO_PORT ?? '9000'}`,
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          ...(isProd
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
            : []),
        ],
      },
    ]
  },

  // Disable powered-by header
  poweredByHeader: false,

  // Webpack: ignore argon2 native build warning
  webpack(config) {
    config.externals = [...(config.externals ?? []), { argon2: 'commonjs argon2' }]
    return config
  },
}

export default nextConfig
