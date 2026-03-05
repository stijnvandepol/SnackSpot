import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SnackSpot Admin Panel',
  description: 'Beheer gebruikers, restaurants en reviews',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  )
}
