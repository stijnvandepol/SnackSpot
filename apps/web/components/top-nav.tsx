'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from './auth-provider'
import { avatarUrl } from '@/lib/avatar'
import { NotificationBell } from './notification-bell'
import { SnackSpotLogo } from './snack-spot-logo'
import { CreateOptions } from '@/components/create-options'
import { SHARED_NAV_LINKS } from '@/lib/nav-links'

/** Desktop "Post" button → popover with the same Review/Bite chooser as mobile. */
function CreatePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative ml-2" ref={ref}>
      <button
        type="button"
        className="btn-primary py-2 text-sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Post
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Create a review or bite"
          className="absolute right-0 top-full z-40 mt-2 w-80 rounded-2xl border p-4 shadow-xl"
          style={{ backgroundColor: 'var(--snack-bg)', borderColor: 'var(--snack-border-soft)' }}
        >
          <p className="mb-3 text-sm font-semibold text-snack-text">What are you sharing?</p>
          <CreateOptions onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}

export function TopNav() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const navLinks = SHARED_NAV_LINKS

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
          <CreatePopover />
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
