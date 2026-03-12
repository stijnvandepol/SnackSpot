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
      <div className="md:hidden sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#ececec]">
        <div className="h-14 px-4 flex items-center">
          <Link href="/feed" className="font-heading font-bold text-xl leading-none">
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

      <footer className="border-t border-[#ececec] bg-white/90">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-5 px-4 py-3 text-sm">
          <Link href="/guides" className="font-semibold text-snack-primary hover:underline">
            Guides
          </Link>
          <Link href="/search" className="text-snack-muted hover:text-snack-text">
            Explore
          </Link>
          <Link href="/nearby" className="text-snack-muted hover:text-snack-text">
            Nearby
          </Link>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  )
}
