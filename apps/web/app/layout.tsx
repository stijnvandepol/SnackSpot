import type { Metadata, Viewport } from 'next'
import { Inter, Poppins } from 'next/font/google'
import { AuthProvider } from '@/components/auth-provider'
import { CookieConsent } from '@/components/cookie-consent'
import { getSiteOrigin } from '@/lib/site-url'
import './globals.css'

const metadataBase = getSiteOrigin()
const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim()
const appDescription =
  'Discover under-the-radar food spots with SnackSpot. Share reviews of smaller local places, surface hidden gems, and help others find great food they would otherwise miss.'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-poppins' })

export const viewport: Viewport = {
  themeColor: '#F97316',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase,
  applicationName: 'SnackSpot',
  title: { default: 'SnackSpot', template: '%s | SnackSpot' },
  description: appDescription,
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
      { url: '/icons/favicon-64x64.png', sizes: '64x64', type: 'image/png' },
      { url: '/icons/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon.png', sizes: '1024x1024', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Snack Spot' },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  openGraph: {
    title: 'SnackSpot',
    description: appDescription,
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SnackSpot',
    description: appDescription,
    images: ['/twitter-image'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${poppins.variable}`}>
      <head />
      <body className="h-full font-body">
        <AuthProvider>
          {children}
          <CookieConsent />
        </AuthProvider>
      </body>
    </html>
  )
}
