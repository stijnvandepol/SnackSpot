import { test, expect } from '@playwright/test'

// ─── Desktop navigation ───────────────────────────────────────────────────────
// TopNav has `hidden md:block`, so it becomes visible at ≥768 px.
// BottomNav has `md:hidden`, so it becomes display:none at ≥768 px.

test.describe('Desktop navigation (1280 px)', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('shows the top navigation header', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('header')).toBeVisible()
  })

  test('top nav contains Home, Explore, Nearby and Post links', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header')
    await expect(header.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(header.getByRole('link', { name: 'Explore' })).toBeVisible()
    await expect(header.getByRole('link', { name: 'Nearby' })).toBeVisible()
    await expect(header.getByRole('link', { name: 'Post' })).toBeVisible()
  })

  test('bottom nav is not visible on desktop', async ({ page }) => {
    await page.goto('/')
    // The BottomNav renders inside a <nav> with md:hidden; at 1280px it is display:none
    const bottomNav = page.locator('nav').filter({ hasText: 'Create new post' })
    await expect(bottomNav).toBeHidden()
  })

  test('Home link has aria-current="page" when on /', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header')
    await expect(header.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  })

  test('Explore link has aria-current="page" on /search', async ({ page }) => {
    await page.goto('/search')
    const header = page.locator('header')
    await expect(header.getByRole('link', { name: 'Explore' })).toHaveAttribute('aria-current', 'page')
  })

  test('Nearby link has aria-current="page" on /nearby', async ({ page }) => {
    await page.goto('/nearby')
    const header = page.locator('header')
    await expect(header.getByRole('link', { name: 'Nearby' })).toHaveAttribute('aria-current', 'page')
  })

  test('shows Log in and Sign up links when not authenticated', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header')
    await expect(header.getByRole('link', { name: 'Log in' })).toBeVisible()
    await expect(header.getByRole('link', { name: 'Sign up' })).toBeVisible()
  })
})

// ─── Mobile navigation ────────────────────────────────────────────────────────

test.describe('Mobile navigation (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('shows the bottom navigation bar', async ({ page }) => {
    await page.goto('/')
    const bottomNav = page.locator('nav').filter({ hasText: 'Create new post' })
    await expect(bottomNav).toBeVisible()
  })

  test('bottom nav has all 5 links', async ({ page }) => {
    await page.goto('/')
    const bottomNav = page.locator('nav').filter({ hasText: 'Create new post' })
    await expect(bottomNav.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: 'Explore' })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: 'Create new post' })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: 'Nearby' })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: 'Profile' })).toBeVisible()
  })

  test('desktop top header is not visible on mobile', async ({ page }) => {
    await page.goto('/')
    // Header has `hidden md:block` so it stays display:none at 390px
    await expect(page.locator('header')).toBeHidden()
  })

  test('mobile brand bar is visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'SnackSpot home' })).toBeVisible()
  })

  test('Home link in bottom nav has aria-current="page" on /', async ({ page }) => {
    await page.goto('/')
    const bottomNav = page.locator('nav').filter({ hasText: 'Create new post' })
    await expect(bottomNav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  })

  test('Explore link in bottom nav has aria-current="page" on /search', async ({ page }) => {
    await page.goto('/search')
    const bottomNav = page.locator('nav').filter({ hasText: 'Create new post' })
    await expect(bottomNav.getByRole('link', { name: 'Explore' })).toHaveAttribute('aria-current', 'page')
  })

  test('clicking a bottom nav link navigates to the correct page', async ({ page }) => {
    await page.goto('/')
    const bottomNav = page.locator('nav').filter({ hasText: 'Create new post' })
    await bottomNav.getByRole('link', { name: 'Explore' }).click()
    await expect(page).toHaveURL('/search')
  })
})
