import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'
import { AuthProvider } from '@/components/auth-provider'
import './globals.css'

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:8080'
const metadataBase = new URL(appUrl)
const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim()

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-poppins' })

export const metadata: Metadata = {
  metadataBase,
  applicationName: 'SnackSpot',
  title: { default: 'SnackSpot', template: '%s | SnackSpot' },
  description: 'Discover and share the best snacks and meals near you.',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-video-preview': -1,
      'max-snippet': -1,
    },
  },
  verification: {
    google: googleSiteVerification || undefined,
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  themeColor: '#F97316',
  viewport: { width: 'device-width', initialScale: 1, viewportFit: 'cover' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Snack Spot' },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  openGraph: {
    title: 'SnackSpot',
    description: 'Discover and share the best snacks and meals near you.',
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SnackSpot',
    description: 'Discover and share the best snacks and meals near you.',
    images: ['/twitter-image'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${poppins.variable}`}>
      <head />
      <body className="h-full font-body">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
