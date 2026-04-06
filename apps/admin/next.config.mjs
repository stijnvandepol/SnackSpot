/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@snackspot/shared', '@snackspot/db'],
  output: 'standalone',
  experimental: {
    // This controls the buffered request body limit used with middleware/proxy.
    middlewareClientMaxBodySize: '5gb',
    serverActions: {
      bodySizeLimit: '5gb',
    },
  },
}

export default nextConfig
