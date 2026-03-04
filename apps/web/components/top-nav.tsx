'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from './auth-provider'

export function TopNav() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const navLinks = [
    { href: '/feed', label: 'Feed' },
    { href: '/nearby', label: 'Nearby' },
    { href: '/search', label: 'Search' },
  ]

  return (
    <header className="hidden md:block sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100">
      <div className="mx-auto max-w-6xl px-4 flex h-16 items-center justify-between gap-4">
        <Link href="/feed" className="flex items-center gap-2 font-bold text-xl text-amber-500">
          🍟 SnackSpot
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                pathname.startsWith(l.href)
                  ? 'bg-amber-50 text-amber-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/add-review" className="btn-primary py-2 text-sm">
                + Add Review
              </Link>
              <Link
                href={`/u/${user.username}`}
                className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-semibold text-sm uppercase"
              >
                {(user.displayName ?? user.username)[0]}
              </Link>
              <button onClick={async () => { await logout(); router.push('/auth/login') }} className="btn-ghost text-sm">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="btn-ghost text-sm">Log in</Link>
              <Link href="/auth/register" className="btn-primary py-2 text-sm">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
