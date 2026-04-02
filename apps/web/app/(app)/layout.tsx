import Link from 'next/link'
import { TopNav } from '@/components/top-nav'
import { BottomNav } from '@/components/bottom-nav'
import { SnackSpotLogo } from '@/components/snack-spot-logo'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:px-3 focus:py-2 focus:text-sm focus:shadow"
        style={{ backgroundColor: 'var(--snack-bg)', color: 'var(--snack-text)' }}
      >
        Skip to content
      </a>

      {/* Desktop top nav */}
      <TopNav />

      {/* Mobile brand bar */}
      <div className="md:hidden sticky top-0 z-40 backdrop-blur border-b" style={{ backgroundColor: 'var(--snack-nav-bg)', borderColor: 'var(--snack-border-soft)' }}>
        <div className="h-14 px-4 flex items-center">
          <Link href="/" aria-label="SnackSpot home">
            <SnackSpotLogo className="text-xl" />
          </Link>
        </div>
      </div>

      <main id="main-content" className="flex-1 pb-nav md:pb-0">
        {children}
      </main>

      <footer className="hidden md:block border-t" style={{ borderColor: 'var(--snack-border-soft)', backgroundColor: 'var(--snack-footer-bg)' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 px-4 py-4 text-sm">
          <Link href="/guides" className="btn-secondary text-sm">
            Guides
          </Link>
          <p className="text-xs text-snack-muted">
            &copy; {new Date().getFullYear()} SnackSpot
          </p>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  )
}
