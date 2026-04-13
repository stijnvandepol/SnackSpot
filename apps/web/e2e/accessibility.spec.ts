import { test, expect } from '@playwright/test'

const PUBLIC_PAGES = [
  { name: 'Home', path: '/' },
  { name: 'Search', path: '/search' },
  { name: 'Login', path: '/auth/login' },
  { name: 'Register', path: '/auth/register' },
]

// ─── Landmark / ARIA basics ───────────────────────────────────────────────────

for (const { name, path } of PUBLIC_PAGES) {
  test.describe(`Accessibility — ${name} (${path})`, () => {
    test('has a non-empty page title', async ({ page }) => {
      await page.goto(path)
      const title = await page.title()
      expect(title.length).toBeGreaterThan(0)
      expect(title).toMatch(/SnackSpot/i)
    })

    test('has a meta description', async ({ page }) => {
      await page.goto(path)
      const content = await page.locator('meta[name="description"]').getAttribute('content')
      expect(content?.length ?? 0).toBeGreaterThan(10)
    })

    test('has a <main> landmark', async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('main')).toBeAttached()
    })

    test('has at least one <nav> landmark', async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('navigation').first()).toBeAttached()
    })

    test('all images have non-empty alt text', async ({ page }) => {
      await page.goto(path)
      // Gather all <img> elements without an alt attribute or with alt=""
      const badImages = await page.locator('img:not([alt]), img[alt=""]').count()
      expect(badImages).toBe(0)
    })

    test('no buttons are missing accessible labels', async ({ page }) => {
      await page.goto(path)
      // Buttons with no text content and no aria-label are inaccessible
      const unlabelledButtons = await page
        .locator('button:not([aria-label]):not([aria-labelledby])')
        .evaluateAll((buttons) =>
          (buttons as HTMLButtonElement[]).filter(
            (btn) => btn.textContent?.trim() === '',
          ).length,
        )
      expect(unlabelledButtons).toBe(0)
    })
  })
}

// ─── Skip link ────────────────────────────────────────────────────────────────

test.describe('Accessibility — skip-to-content link', () => {
  test('skip-to-content link exists and targets #main-content', async ({ page }) => {
    await page.goto('/')
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toBeAttached()
  })

  test('skip link is the first focusable element on Tab', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    const href = await page.locator(':focus').getAttribute('href')
    expect(href).toBe('#main-content')
  })

  test('activating the skip link moves focus to #main-content', async ({ page }) => {
    await page.goto('/')
    // Focus and activate the skip link
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    const focusedId = await page.evaluate(() => document.activeElement?.id)
    expect(focusedId).toBe('main-content')
  })
})

// ─── Keyboard navigation ──────────────────────────────────────────────────────

test.describe('Accessibility — keyboard navigation', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('desktop nav links are reachable by Tab', async ({ page }) => {
    await page.goto('/')
    // Tab enough times to reach nav links; they must eventually be focused
    let found = false
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab')
      const focusedHref = await page.evaluate(() =>
        (document.activeElement as HTMLAnchorElement | null)?.href ?? '',
      )
      if (focusedHref.endsWith('/')) { found = true; break }
    }
    expect(found).toBe(true)
  })
})

// ─── Responsive viewport checks ───────────────────────────────────────────────

test.describe('Accessibility — mobile viewport (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('bottom nav links have min touch target height of 44 px', async ({ page }) => {
    await page.goto('/')
    const nav = page.locator('nav').filter({ hasText: 'Create new post' })
    const links = await nav.getByRole('link').all()

    for (const link of links) {
      const box = await link.boundingBox()
      if (!box) continue
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
  })

  test('login form fields are large enough to tap on mobile', async ({ page }) => {
    await page.goto('/auth/login')
    const inputs = await page.locator('input').all()
    for (const input of inputs) {
      const box = await input.boundingBox()
      if (!box) continue
      expect(box.height).toBeGreaterThanOrEqual(40)
    }
  })
})
