/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@snackspot/shared', '@snackspot/db'],
  output: 'standalone',
  poweredByHeader: false,
  experimental: {
    // Import accepts our own export ZIP; allow a large body for that upload.
    middlewareClientMaxBodySize: '512mb',
    serverActions: {
      bodySizeLimit: '512mb',
    },
  },
  async headers() {
    const isProd = process.env.NODE_ENV === 'production'
    const minioEndpoint = process.env.MINIO_ENDPOINT ?? 'minio'
    const minioPort = process.env.MINIO_PORT ?? '9000'
    const minioInternalOrigin = `http://${minioEndpoint}:${minioPort}`
    const minioPublicOrigin = (() => {
      try {
        return new URL(process.env.MINIO_PUBLIC_URL ?? minioInternalOrigin).origin
      } catch {
        return minioInternalOrigin
      }
    })()
    // The admin panel runs no third-party scripts; keep the policy strict.
    const scriptSrc = isProd
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-eval' 'unsafe-inline'"

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: ${isProd ? '' : minioInternalOrigin} ${minioPublicOrigin}`.replace(/  +/g, ' '),
              "font-src 'self'",
              `connect-src 'self' ${isProd ? '' : minioInternalOrigin} ${minioPublicOrigin}`.replace(/  +/g, ' '),
              "worker-src blob: 'self'",
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
  webpack(config) {
    config.externals = [...(config.externals ?? []), { argon2: 'commonjs argon2' }]
    return config
  },
}

export default nextConfig
