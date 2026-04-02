import type { Metadata, Viewport } from 'next'
import { Inter, Poppins } from 'next/font/google'
import { AuthProvider } from '@/components/auth-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { CookieConsent } from '@/components/cookie-consent'
import { getSiteOrigin, getSiteUrl } from '@/lib/site-url'
import './globals.css'

const metadataBase = getSiteOrigin()
const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim()
const appDescription =
  'Discover under-the-radar food spots with SnackSpot. Share reviews of smaller local places, surface hidden gems, and help others find great food they would otherwise miss.'

function buildJsonLd(appUrl: string) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'SnackSpot',
      url: appUrl,
      logo: `${appUrl}/icons/favicon-48x48.png`,
      description: appDescription,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'SnackSpot',
      url: appUrl,
      description: appDescription,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${appUrl}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'SnackSpot',
      url: appUrl,
      description: appDescription,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'All',
      offers: {
        '@type': 'Offer',
        price: 0,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    },
  ]
}

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-poppins', display: 'swap' })

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
    canonical: getSiteUrl(),
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
      { url: '/favicon.ico', sizes: '48x48 32x32' },
      { url: '/icons/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Snack Spot' },
  openGraph: {
    type: 'website',
    title: 'SnackSpot',
    description: appDescription,
    siteName: 'SnackSpot',
    locale: 'en_US',
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
  const appUrl = getSiteUrl()
  const jsonLd = buildJsonLd(appUrl)
  return (
    <html lang="en" className={`h-full ${inter.variable} ${poppins.variable}`} suppressHydrationWarning>
      <head>
        {/* Runs synchronously before React hydrates to prevent a flash of the wrong theme
            (FOUC). Must stay inline — an external script would load async and fire too late. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('snackspot-theme');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="h-full font-body">
        <ThemeProvider>
          <AuthProvider>
            {children}
            <CookieConsent />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
