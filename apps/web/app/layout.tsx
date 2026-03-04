import type { Metadata } from 'next'
import { AuthProvider } from '@/components/auth-provider'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'SnackSpot', template: '%s | SnackSpot' },
  description: 'Discover and share the best snacks and meals near you.',
  themeColor: '#f59e0b',
  viewport: { width: 'device-width', initialScale: 1, viewportFit: 'cover' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'SnackSpot' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head />
      <body className="h-full">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
