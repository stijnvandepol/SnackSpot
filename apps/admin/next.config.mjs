/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@snackspot/shared', '@snackspot/db'],
  output: 'standalone',
  experimental: {
    // Keep import uploads workable for large backup archives.
    proxyClientMaxBodySize: '2gb',
    serverActions: {
      bodySizeLimit: '50gb',
    },
  },
}

export default nextConfig
