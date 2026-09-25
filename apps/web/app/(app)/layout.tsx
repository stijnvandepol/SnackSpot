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
        Naar de inhoud
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

      <main id="main-content" className="flex-1">
        {children}
      </main>

      {/*
        Visible on mobile too. It used to be `hidden md:block`, which meant the only
        internal links to /eettentjes, /guides and the legal pages did not exist on the
        surface where ~72% of impressions land — and /eettentjes, the main commercial
        surface, had no internal links at all. `pb-nav` moves from <main> to here so the
        fixed BottomNav cannot cover the last row.
      */}
      <footer className="border-t pb-nav md:pb-0" style={{ borderColor: 'var(--snack-border-soft)', backgroundColor: 'var(--snack-footer-bg)' }}>
        {/*
          Compact on phones: this sits under an infinite feed, so it is chrome, not a
          destination. Buttons became plain links and the vertical rhythm tightens —
          the desktop footer keeps its original breathing room.
        */}
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-2 px-4 py-4 text-sm md:gap-3 md:py-6">
          <nav aria-label="Ontdekken" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm font-medium">
            <Link href="/eettentjes" className="text-snack-primary hover:underline">
              Eettentjes per stad
            </Link>
            <Link href="/gerechten" className="text-snack-primary hover:underline">
              Beste per gerecht
            </Link>
            <Link href="/guides" className="text-snack-primary hover:underline">
              Uitleg
            </Link>
          </nav>
          <nav aria-label="Juridisch" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-snack-muted">
            <Link href="/terms" className="hover:text-snack-text">Voorwaarden</Link>
            <Link href="/privacy" className="hover:text-snack-text">Privacy</Link>
            <Link href="/subprocessors" className="hover:text-snack-text">Subverwerkers</Link>
            <Link href="/imprint" className="hover:text-snack-text">Bedrijfsgegevens</Link>
          </nav>
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
