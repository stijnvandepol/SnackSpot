'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SHARED_NAV_LINKS } from '@/lib/nav-links'
import { CreateOptions } from '@/components/create-options'

type IconName = 'home' | 'search' | 'map' | 'user'

// Derive bottom-nav entries from the shared route list so href/label stay in sync.
// The center button is not a link: it opens the create-sheet (review or bite).
const links = [
  { href: SHARED_NAV_LINKS[0].href, icon: 'home'   as IconName, label: SHARED_NAV_LINKS[0].label },
  { href: SHARED_NAV_LINKS[1].href, icon: 'search' as IconName, label: SHARED_NAV_LINKS[1].label },
  { href: SHARED_NAV_LINKS[2].href, icon: 'map'    as IconName, label: SHARED_NAV_LINKS[2].label },
  { href: '/profile',               icon: 'user'   as IconName, label: 'Profile' },
]

function NavIcon({ name, className }: { name: IconName; className?: string }) {
  if (name === 'home') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>
  }
  if (name === 'search') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
  }
  if (name === 'map') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20V6.5Z"/><path d="M9 4v13.5M15 6.5V20"/></svg>
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>
}

function NavLink({ href, icon, label, active }: { href: string; icon: IconName; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center gap-0.5 py-1 text-xs font-medium transition min-h-[44px] justify-center ${
        active ? 'text-snack-primary' : 'text-snack-muted'
      }`}
    >
      <NavIcon name={icon} className="h-6 w-6" />
      <span>{label}</span>
    </Link>
  )
}

/** Bottom sheet: choose between a public review and a 24h bite. */
function CreateSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="md:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Create a review or bite">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t p-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-[0_-12px_40px_rgba(15,23,42,0.18)]"
        style={{ backgroundColor: 'var(--snack-bg)', borderColor: 'var(--snack-border-soft)' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-snack-border" aria-hidden="true" />
        <p className="mb-3 text-center text-sm font-semibold text-snack-text">What are you sharing?</p>
        <CreateOptions onPick={onClose} />
      </div>
    </div>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)

  const createActive = pathname.startsWith('/add-review') || pathname.startsWith('/add-bite')

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 backdrop-blur border-t pb-[env(safe-area-inset-bottom)]" style={{ backgroundColor: 'var(--snack-nav-bg)', borderColor: 'var(--snack-border-soft)' }}>
        <ul className="flex h-[4.5rem] items-end pb-2">
          <li className="flex-1">
            <NavLink href={links[0].href} icon={links[0].icon} label={links[0].label} active={pathname === '/'} />
          </li>
          <li className="flex-1">
            <NavLink href={links[1].href} icon={links[1].icon} label={links[1].label} active={pathname.startsWith(links[1].href)} />
          </li>
          <li className="flex-1">
            <button
              type="button"
              aria-label="Create a review or bite"
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen((open) => !open)}
              className={`flex w-full flex-col items-center gap-0.5 py-1 text-xs font-medium transition min-h-[44px] justify-center ${
                createActive ? 'text-snack-primary' : 'text-white'
              }`}
            >
              <span className="flex h-16 w-16 items-center justify-center mt-0 relative">
                <svg viewBox="0 0 16 20" fill="none" className="h-12 w-10 text-snack-primary drop-shadow-sm" aria-hidden="true">
                  <path d="M8 19c2.6-3.5 6-7.5 6-11a6 6 0 1 0-12 0c0 3.5 3.4 7.5 6 11Z" fill="currentColor"/>
                </svg>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="absolute h-6 w-6 top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </span>
              <span className="sr-only">Post</span>
            </button>
          </li>
          <li className="flex-1">
            <NavLink href={links[2].href} icon={links[2].icon} label={links[2].label} active={pathname.startsWith(links[2].href)} />
          </li>
          <li className="flex-1">
            <NavLink href={links[3].href} icon={links[3].icon} label={links[3].label} active={pathname.startsWith(links[3].href)} />
          </li>
        </ul>
      </nav>

      {sheetOpen && <CreateSheet onClose={() => setSheetOpen(false)} />}
    </>
  )
}
