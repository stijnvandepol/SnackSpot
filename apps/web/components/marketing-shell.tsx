'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SnackSpotLogo } from './snack-spot-logo'
import { LanguageSwitcher } from './language-switcher'
import type { Locale } from '@/lib/i18n/config'
import type { MarketingDict } from '@/lib/i18n/types'

export function MarketingShell({ children, locale, dict }: { children: React.ReactNode; locale: Locale; dict: MarketingDict }) {
  const pathname = usePathname()

  const navItems = [
    { href: '/product#problem', label: dict.nav.problem, match: null },
    { href: '/product#features', label: dict.nav.features, match: null },
    { href: '/product#why', label: dict.nav.why, match: null },
    { href: '/guides', label: dict.nav.guides, match: '/guides' },
    { href: '/product/releases', label: dict.nav.releases, match: '/product/releases' },
  ]

  return (
    <div className="force-light min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.14),_transparent_32%),linear-gradient(180deg,#fff7ed_0%,#ffffff_28%,#ffffff_100%)] text-snack-text">
      <header className="sticky top-0 z-30 border-b backdrop-blur" style={{ backgroundColor: 'var(--snack-nav-bg)', borderColor: 'var(--snack-border-soft)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 h-16 sm:px-4 md:gap-4">
          <Link href="/product" className="shrink-0">
            <SnackSpotLogo className="text-lg sm:text-xl" />
          </Link>
          <nav aria-label="Product navigation" className="hidden items-center gap-5 text-sm text-snack-muted md:flex">
            {navItems.map((item) => {
              const active = item.match && pathname.startsWith(item.match)
              return active ? (
                <span key={item.label} className="font-semibold text-snack-text">{item.label}</span>
              ) : (
                <Link key={item.label} href={item.href} className="hover:text-snack-text">{item.label}</Link>
              )
            })}
          </nav>
          <div className="flex items-center gap-1.5 shrink-0">
            <LanguageSwitcher current={locale} />
            <Link href="/auth/login" className="btn-ghost whitespace-nowrap px-2 text-xs sm:px-2.5 sm:text-sm">{dict.nav.login}</Link>
            <Link href="/auth/register" className="btn-primary whitespace-nowrap px-2 text-xs sm:px-2.5 sm:text-sm">{dict.nav.createAccount}</Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="px-4 pb-10 pt-4 text-center">
        <nav aria-label="Legal" className="mb-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-snack-muted">
          <Link href="/terms" className="hover:text-snack-text">Terms</Link>
          <Link href="/privacy" className="hover:text-snack-text">Privacy</Link>
          <Link href="/subprocessors" className="hover:text-snack-text">Sub-processors</Link>
          <Link href="/imprint" className="hover:text-snack-text">Company info</Link>
        </nav>
        <p className="text-sm font-medium text-snack-muted">&copy; {new Date().getFullYear()} SnackSpot</p>
      </footer>
    </div>
  )
}
