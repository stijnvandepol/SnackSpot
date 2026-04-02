'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from './auth-provider'
import { avatarUrl } from '@/lib/avatar'
import { NotificationBell } from './notification-bell'
import { SnackSpotLogo } from './snack-spot-logo'

export function TopNav() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/search', label: 'Explore' },
    { href: '/nearby', label: 'Nearby' },
  ]

  return (
    <header className="hidden md:block sticky top-0 z-30 backdrop-blur border-b" style={{ backgroundColor: 'var(--snack-nav-bg)', borderColor: 'var(--snack-border-soft)' }}>
      <div className="mx-auto max-w-6xl px-4 flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="SnackSpot home">
          <SnackSpotLogo className="text-xl" />
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={(l.href === '/' ? pathname === '/' : pathname.startsWith(l.href)) ? 'page' : undefined}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                (l.href === '/' ? pathname === '/' : pathname.startsWith(l.href))
                  ? 'bg-snack-surface text-snack-primary'
                  : 'text-snack-muted hover:bg-snack-surface'
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link href="/add-review" className="btn-primary py-2 text-sm ml-2">
            Post
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationBell />
              <Link
                href="/profile"
                aria-label="Open profile"
                className="h-11 w-11 rounded-full bg-snack-surface flex items-center justify-center text-snack-primary font-semibold text-sm uppercase overflow-hidden"
              >
                {user.avatarKey ? (
                  <Image
                    src={avatarUrl(user.avatarKey) ?? ''}
                    alt="Profile avatar"
                    width={44}
                    height={44}
                    className="rounded-full object-cover"
                  />
                ) : (
                  user.username[0]
                )}
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
