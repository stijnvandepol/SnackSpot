'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from './auth-provider'
import { avatarUrl } from '@/lib/avatar'

export function TopNav() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const navLinks = [
    { href: '/feed', label: 'Home' },
    { href: '/search', label: 'Explore' },
    { href: '/nearby', label: 'Nearby' },
  ]

  return (
    <header className="hidden md:block sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-[#ececec]">
      <div className="mx-auto max-w-6xl px-4 flex h-16 items-center justify-between gap-4">
        <Link href="/feed" className="font-heading font-bold text-xl leading-none">
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
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                pathname.startsWith(l.href)
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
              <Link
                href="/profile"
                className="h-9 w-9 rounded-full bg-snack-surface flex items-center justify-center text-snack-primary font-semibold text-sm uppercase"
              >
                {user.avatarKey ? (
                  <img src={avatarUrl(user.avatarKey) ?? undefined} alt="" className="h-full w-full rounded-full object-cover" />
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
