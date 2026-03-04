'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type IconName = 'home' | 'search' | 'plus' | 'map' | 'user'

const links = [
  { href: '/feed',       icon: 'home' as IconName, label: 'Home' },
  { href: '/search',     icon: 'search' as IconName, label: 'Explore' },
  { href: '/add-review', icon: 'plus' as IconName, label: 'Post', accent: true },
  { href: '/nearby',     icon: 'map' as IconName, label: 'Map' },
  { href: '/profile',    icon: 'user' as IconName, label: 'Profile' },
]

function NavIcon({ name, className }: { name: IconName; className?: string }) {
  if (name === 'home') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>
  }
  if (name === 'search') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
  }
  if (name === 'plus') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M12 5v14M5 12h14"/></svg>
  }
  if (name === 'map') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20V6.5Z"/><path d="M9 4v13.5M15 6.5V20"/></svg>
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>
}

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-[#ececec] pb-[env(safe-area-inset-bottom)]">
      <ul className="flex h-[4.5rem] items-end pb-2">
        {links.map((l) => {
          const active = pathname.startsWith(l.href)
          return (
            <li key={l.href} className="flex-1">
              <Link
                href={l.href}
                className={`flex flex-col items-center gap-0.5 py-1 text-xs font-medium transition ${
                  l.accent
                    ? 'text-white'
                    : active
                    ? 'text-snack-primary'
                    : 'text-snack-muted'
                }`}
              >
                {l.accent ? (
                  <span className="flex h-12 w-12 items-center justify-center -mt-5">
                    <svg viewBox="0 0 16 20" fill="none" className="h-8 w-6 text-snack-primary drop-shadow-sm" aria-hidden="true">
                      <path d="M8 19c2.6-3.5 6-7.5 6-11a6 6 0 1 0-12 0c0 3.5 3.4 7.5 6 11Z" fill="currentColor"/>
                      <circle cx="8" cy="8" r="2.25" fill="white"/>
                    </svg>
                  </span>
                ) : (
                  <NavIcon name={l.icon} className="h-6 w-6" />
                )}
                {!l.accent && <span>{l.label}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
