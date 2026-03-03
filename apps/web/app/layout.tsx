import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SnackSpot',
  description: 'Reviews van snacks en maaltijden in je buurt'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
