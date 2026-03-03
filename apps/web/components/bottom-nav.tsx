import Link from 'next/link';

const tabs = [
  { href: '/feed', label: 'Feed' },
  { href: '/nearby', label: 'Nearby' },
  { href: '/search', label: 'Search' },
  { href: '/add-review', label: 'Add' },
  { href: '/profile', label: 'Profile' }
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-white md:hidden">
      <ul className="mx-auto grid max-w-xl grid-cols-5 text-xs">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link href={tab.href} className="block px-2 py-3 text-center font-medium text-zinc-700">
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
