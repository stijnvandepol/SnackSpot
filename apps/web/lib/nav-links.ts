/**
 * The three navigation links shared by TopNav (desktop) and BottomNav (mobile).
 * Keeping them in one place ensures href/label changes only happen once.
 */
export const SHARED_NAV_LINKS = [
  { href: '/',       label: 'Home'    },
  { href: '/search', label: 'Explore' },
  { href: '/nearby', label: 'Nearby'  },
] as const satisfies ReadonlyArray<{ href: string; label: string }>
