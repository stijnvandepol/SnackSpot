'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SnackSpotLogo } from './snack-spot-logo'
import { LanguageSwitcher } from './language-switcher'
import type { Locale } from '@/lib/i18n/config'
import type { MarketingDict } from '@/lib/i18n/types'

/**
 * Chrome for the marketing pages (/product, /product/releases). Same header height,
 * tokens and buttons as the app's TopNav so the two surfaces read as one product;
 * the marketing pages are locked to the light theme because their photography and
 * the ink-coloured city block are designed against white.
 */
export function MarketingShell({ children, locale, dict }: { children: React.ReactNode; locale: Locale; dict: MarketingDict }) {
  const pathname = usePathname()

  const navItems = [
    { href: '/product#hoe-het-werkt', label: dict.nav.howItWorks, match: null },
    { href: '/snackplekken', label: dict.nav.cities, match: '/snackplekken' },
    { href: '/guides', label: dict.nav.guides, match: '/guides' },
    { href: '/product/releases', label: dict.nav.releases, match: '/product/releases' },
  ]

  return (
    <div className="force-light min-h-screen bg-snack-background text-snack-text">
      <header className="sticky top-0 z-30 border-b backdrop-blur" style={{ backgroundColor: 'var(--snack-nav-bg)', borderColor: 'var(--snack-border-soft)' }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 md:gap-4">
          <Link href="/product" className="shrink-0" aria-label="SnackSpot">
            <SnackSpotLogo className="text-xl" />
          </Link>
          <nav aria-label={locale === 'nl' ? 'Hoofdmenu' : 'Main menu'} className="hidden items-center gap-6 text-sm font-medium text-snack-muted md:flex">
            {navItems.map((item) => {
              const active = item.match && pathname.startsWith(item.match)
              return active ? (
                <span key={item.label} className="text-snack-text">{item.label}</span>
              ) : (
                <Link key={item.label} href={item.href} className="transition-colors hover:text-snack-text">{item.label}</Link>
              )
            })}
          </nav>
          <div className="flex shrink-0 items-center gap-1.5">
            <LanguageSwitcher current={locale} />
            <Link href="/auth/login" className="btn-ghost whitespace-nowrap px-2.5 text-sm">{dict.nav.login}</Link>
            <Link href="/auth/register" className="btn-primary whitespace-nowrap px-3 text-sm sm:px-4">{dict.nav.createAccount}</Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t" style={{ borderColor: 'var(--snack-border-soft)' }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-snack-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">&copy; {new Date().getFullYear()} SnackSpot</p>
          <nav aria-label={locale === 'nl' ? 'Juridisch' : 'Legal'} className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/terms" className="hover:text-snack-text">{dict.footer.terms}</Link>
            <Link href="/privacy" className="hover:text-snack-text">{dict.footer.privacy}</Link>
            <Link href="/subprocessors" className="hover:text-snack-text">{dict.footer.subprocessors}</Link>
            <Link href="/imprint" className="hover:text-snack-text">{dict.footer.imprint}</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
