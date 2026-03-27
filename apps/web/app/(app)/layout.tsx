import Link from 'next/link'
import { TopNav } from '@/components/top-nav'
import { BottomNav } from '@/components/bottom-nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>

      {/* Desktop top nav */}
      <TopNav />

      {/* Mobile brand bar */}
      <div className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#ececec]">
        <div className="h-14 px-4 flex items-center">
          <Link href="/" className="font-heading font-bold text-xl leading-none">
            <span className="text-snack-primary">Snack</span>
            <span className="text-snack-accent inline-flex items-center">
              Sp
              <span className="inline-flex h-[0.95em] w-[0.75em] items-center justify-center align-middle">
                <svg viewBox="0 0 16 20" fill="none" className="h-[0.95em] w-[0.75em]" aria-hidden="true">
                  <path d="M8 19c2.6-3.5 6-7.5 6-11a6 6 0 1 0-12 0c0 3.5 3.4 7.5 6 11Z" fill="currentColor"/>
                  <circle cx="8" cy="8" r="2.25" fill="white"/>
                </svg>
              </span>
              t
            </span>
          </Link>
        </div>
      </div>

      <main id="main-content" className="flex-1 pb-nav md:pb-0">
        {children}
      </main>

      <footer className="hidden md:block border-t border-[#ececec] bg-white/90">
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
