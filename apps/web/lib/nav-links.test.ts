import { describe, it, expect } from 'vitest'
import { SHARED_NAV_LINKS, TOP_NAV_LINKS } from './nav-links'

describe('navigation links', () => {
  it('keeps exactly three routes in the mobile bar', () => {
    // BottomNav indexes into SHARED_NAV_LINKS by position and has no free slot beside
    // the create button and /profile. Growing this array silently drops the extra entry.
    expect(SHARED_NAV_LINKS).toHaveLength(3)
  })

  it('links to the city index from the desktop nav', () => {
    // /eettentjes is the site's main commercial surface. It shipped in the sitemap with
    // zero internal links anywhere on the site, so it received no internal link equity
    // at all. It must stay reachable from the chrome.
    expect(TOP_NAV_LINKS.map((link) => link.href)).toContain('/eettentjes')
  })

  it('keeps the mobile routes first so the BottomNav positions still hold', () => {
    expect(TOP_NAV_LINKS.slice(0, 3)).toEqual([...SHARED_NAV_LINKS])
  })
})
