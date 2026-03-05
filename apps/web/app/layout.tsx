import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'
import { AuthProvider } from '@/components/auth-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-poppins' })

export const metadata: Metadata = {
  title: { default: 'SnackSpot', template: '%s | SnackSpot' },
  description: 'Discover and share the best snacks and meals near you.',
  manifest: '/manifest.webmanifest',
  themeColor: '#F97316',
  viewport: { width: 'device-width', initialScale: 1, viewportFit: 'cover' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Snack Spot' },
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
