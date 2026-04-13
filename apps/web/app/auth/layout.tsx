import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#auth-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:px-3 focus:py-2 focus:text-sm focus:shadow"
        style={{ backgroundColor: 'var(--snack-bg)', color: 'var(--snack-text)' }}
      >
        Skip to content
      </a>
      <main id="auth-main">
        {children}
      </main>
    </>
  )
}
