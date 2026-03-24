import Link from 'next/link'

function BrandMark() {
  return (
    <span className="font-heading text-xl font-bold leading-none">
      <span className="text-snack-primary">Snack</span>
      <span className="inline-flex items-center text-snack-accent">
        Sp
        <span className="inline-flex h-[0.95em] w-[0.75em] items-center justify-center align-middle">
          <svg viewBox="0 0 16 20" fill="none" className="h-[0.95em] w-[0.75em]" aria-hidden="true">
            <path d="M8 19c2.6-3.5 6-7.5 6-11a6 6 0 1 0-12 0c0 3.5 3.4 7.5 6 11Z" fill="currentColor" />
            <circle cx="8" cy="8" r="2.25" fill="white" />
          </svg>
        </span>
        t
      </span>
    </span>
  )
}

export function GuidesShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.14),_transparent_32%),linear-gradient(180deg,#fff7ed_0%,#ffffff_28%,#ffffff_100%)] text-snack-text">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/product" className="shrink-0">
            <BrandMark />
          </Link>
          <nav aria-label="Guides navigation" className="hidden items-center gap-5 text-sm text-snack-muted md:flex">
            <Link href="/product#problem" className="hover:text-snack-text">Problem</Link>
            <Link href="/product#features" className="hover:text-snack-text">Features</Link>
            <Link href="/product#why" className="hover:text-snack-text">Why SnackSpot</Link>
            <Link href="/guides" className="font-semibold text-snack-text">Guides</Link>
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
