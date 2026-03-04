import { TopNav } from '@/components/top-nav'
import { BottomNav } from '@/components/bottom-nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      {/* Desktop top nav */}
      <TopNav />

      {/* Mobile brand bar */}
      <div className="md:hidden sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#ececec]">
        <div className="h-14 px-4 flex items-center font-heading font-bold text-xl leading-none">
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
        </div>
      </div>

      <main className="flex-1 pb-nav md:pb-0">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  )
}
