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
        hostname: process.env.MINIO_ENDPOINT ?? 'minio',
        port: process.env.MINIO_PORT ?? '9000',
        pathname: `/${bucket}/**`,
      }

      try {
        const publicUrl = new URL(process.env.MINIO_PUBLIC_URL ?? 'https://snackspot.online')
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

  async redirects() {
    return [
      // Guides live at /guides (app side). These cover the brief window the PR
      // nested them under /product before they were moved back.
      { source: '/product/guides', destination: '/guides', permanent: true },
      { source: '/product/guides/:slug', destination: '/guides/:slug', permanent: true },
      { source: '/releases', destination: '/product/releases', permanent: true },
    ]
  },

  async headers() {
    const isProd = process.env.NODE_ENV === 'production'
    const DAY = 86400

    // Crawler-facing files must stay reachable even when the origin is unhealthy.
    //
    // Google treats an unfetchable robots.txt as a signal to pause crawling the whole
    // host, so a few minutes of origin downtime costs sitewide crawl coverage — GSC
    // reported robots.txt unavailable for 1.32% of requests in Aug 2026. Both files were
    // being served with `max-age=0, must-revalidate`, which left robots.txt uncached
    // (EXPIRED) and sitemap.xml never cached at all (DYNAMIC), so every crawler hit
    // reached the origin and each sitemap fetch ran a full places+reviews+users scan.
    //
    // `stale-if-error` is the directive that fixes it: on a 5xx the edge keeps serving
    // the last good copy. `stale-while-revalidate` keeps refreshes off the critical path.
    const crawlerCache = (sMaxAge) =>
      `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${DAY}, stale-if-error=${7 * DAY}`
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
    const scriptSrc = isProd
      ? "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com"
      : "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com"

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
              `img-src 'self' data: blob: ${isProd ? '' : minioInternalOrigin} ${minioPublicOrigin} https://*.basemaps.cartocdn.com`.replace(/  +/g, ' '),
              "font-src 'self'",
              `connect-src 'self' ${isProd ? '' : minioInternalOrigin} ${minioPublicOrigin} https://nominatim.openstreetmap.org https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://ipapi.co https://challenges.cloudflare.com`.replace(/  +/g, ' '),
              "worker-src blob: 'self'",
              "frame-src https://challenges.cloudflare.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          ...(isProd
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
            : []),
        ],
      },
      // robots.txt is effectively static — a day at the edge costs nothing and a week of
      // stale-if-error means an outage can never pause crawling of the host.
      {
        source: '/robots.txt',
        headers: [{ key: 'Cache-Control', value: crawlerCache(DAY) }],
      },
      // sitemap.xml trades discovery latency for origin load: an hour matches the
      // `revalidate = 3600` already declared in app/sitemap.ts, so new places and reviews
      // surface within the hour while the DB scan runs at most once per hour per edge PoP.
      {
        source: '/sitemap.xml',
        headers: [{ key: 'Cache-Control', value: crawlerCache(3600) }],
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
