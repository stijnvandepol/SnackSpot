/**
 * Navigation routes shared by TopNav (desktop) and BottomNav (mobile).
 * Keeping them in one place ensures href/label changes only happen once.
 */

/**
 * The three routes that fit in the mobile bottom bar alongside the create
 * button and /profile. BottomNav indexes into this by position, so the order
 * is load-bearing — append to TOP_NAV_LINKS instead of adding entries here.
 */
export const SHARED_NAV_LINKS = [
  { href: '/',       label: 'Home'    },
  { href: '/search', label: 'Ontdek'  },
  { href: '/nearby', label: 'Dichtbij' },
] as const satisfies ReadonlyArray<{ href: string; label: string }>

/**
 * Desktop navigation. Carries the city index as well, which has no room in the
 * five-slot mobile bar — on mobile it is reached from the homepage city strip
 * and the footer instead. /snackbars is the site's main commercial surface, so
 * it must be reachable by internal links from every page, not just the sitemap.
 */
export const TOP_NAV_LINKS = [
  ...SHARED_NAV_LINKS,
  { href: '/snackbars', label: 'Snackbars' },
] as const satisfies ReadonlyArray<{ href: string; label: string }>
