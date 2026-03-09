import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SnackSpot',
    short_name: 'SnackSpot',
    description: 'Discover and share the best snacks and meals near you.',
    id: '/',
    scope: '/',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFF7ED',
    theme_color: '#F97316',
    icons: [
      { src: '/favicon.ico', sizes: '48x48 64x64', type: 'image/x-icon' },
      { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-256.png', sizes: '256x256', type: 'image/png' },
      { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
