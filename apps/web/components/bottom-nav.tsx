'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/feed',       icon: '🏠', label: 'Feed' },
  { href: '/nearby',     icon: '📍', label: 'Nearby' },
  { href: '/add-review', icon: '➕', label: 'Add',    accent: true },
  { href: '/search',     icon: '🔍', label: 'Search' },
  { href: '/profile',    icon: '👤', label: 'Profile' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-100 pb-[env(safe-area-inset-bottom)]">
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
                    ? 'text-amber-500'
                    : 'text-gray-400'
                }`}
              >
                {l.accent ? (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-2xl shadow-lg -mt-5">
                    {l.icon}
                  </span>
                ) : (
                  <span className="text-2xl">{l.icon}</span>
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
