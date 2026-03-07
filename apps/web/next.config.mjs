/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  compress: true,
  reactStrictMode: true,

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: (() => {
      const bucket = process.env.MINIO_BUCKET ?? 'snackspot'
      const internal = {
        protocol: 'http',
        hostname: process.env.MINIO_ENDPOINT ?? 'localhost',
        port: process.env.MINIO_PORT ?? '9000',
        pathname: `/${bucket}/**`,
      }

      try {
        const publicUrl = new URL(process.env.MINIO_PUBLIC_URL ?? 'http://localhost:9000')
        return [
          internal,
          {
            protocol: publicUrl.protocol.replace(':', ''),
            hostname: publicUrl.hostname,
            port: publicUrl.port || undefined,
            pathname: `/${bucket}/**`,
          },
        ]
      } catch {
        return [internal]
      }
    })(),
  },

  async headers() {
    const isProd = process.env.NODE_ENV === 'production'
    const minioEndpoint = process.env.MINIO_ENDPOINT ?? 'localhost'
    const minioPort = process.env.MINIO_PORT ?? '9000'
    const minioInternalOrigin = `http://${minioEndpoint}:${minioPort}`
    const minioPublicOrigin = (() => {
      try {
        return new URL(process.env.MINIO_PUBLIC_URL ?? minioInternalOrigin).origin
      } catch {
        return minioInternalOrigin
      }
    })()
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
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: ${minioInternalOrigin} ${minioPublicOrigin} https://*.basemaps.cartocdn.com`,
              "font-src 'self' https://fonts.gstatic.com",
              `connect-src 'self' ${minioInternalOrigin} ${minioPublicOrigin} https://nominatim.openstreetmap.org https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com`,
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

  poweredByHeader: false,

  webpack(config) {
    config.externals = [...(config.externals ?? []), { argon2: 'commonjs argon2' }]
    return config
  },
}

export default nextConfig
