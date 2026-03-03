import Link from 'next/link';

export function TopNav() {
  return (
    <header className="hidden border-b bg-white md:block">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/feed" className="text-lg font-bold">
          SnackSpot
        </Link>
        <nav className="flex gap-5 text-sm">
          <Link href="/feed">Feed</Link>
          <Link href="/nearby">Nearby</Link>
          <Link href="/search">Search</Link>
          <Link href="/add-review">Add Review</Link>
        </nav>
      </div>
    </header>
  );
}
