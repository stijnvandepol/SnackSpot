'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SnackSpotLogo } from './snack-spot-logo'

const navItems = [
  { href: '/product#problem', label: 'Problem', match: null },
  { href: '/product#features', label: 'Features', match: null },
  { href: '/product#why', label: 'Why SnackSpot', match: null },
  { href: '/guides', label: 'Guides', match: '/guides' },
  { href: '/releases', label: 'Release Notes', match: '/releases' },
] as const

export function MarketingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.14),_transparent_32%),linear-gradient(180deg,#fff7ed_0%,#ffffff_28%,#ffffff_100%)] dark:bg-[linear-gradient(180deg,#1c1917_0%,#0c0a09_100%)] text-snack-text">
      <header className="sticky top-0 z-30 border-b backdrop-blur" style={{ backgroundColor: 'var(--snack-nav-bg)', borderColor: 'var(--snack-border-soft)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 h-16">
          <Link href="/product" className="shrink-0">
            <SnackSpotLogo className="text-xl" />
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
          <div className="flex items-center gap-2">
            <Link href="/auth/login" className="btn-ghost text-sm">Log in</Link>
            <Link href="/auth/register" className="btn-primary text-sm">Create account</Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="px-4 pb-10 pt-4 text-center">
        <p className="text-sm font-medium text-snack-muted">&copy; {new Date().getFullYear()} SnackSpot</p>
      </footer>
    </div>
  )
}
