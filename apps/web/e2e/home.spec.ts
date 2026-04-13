import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test('loads with HTTP 200', async ({ page }) => {
    const res = await page.goto('/')
    expect(res?.status()).toBe(200)
  })

  test('has a title containing SnackSpot', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/SnackSpot/i)
  })

  test('renders the feed heading', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: /Latest Food Reviews/i })).toBeVisible()
  })

  test('has a <main> landmark with id="main-content"', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('main#main-content')).toBeAttached()
  })

  test('has a skip-to-content link targeting #main-content', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('a[href="#main-content"]')).toBeAttached()
  })
})

// ─── Mobile-specific checks ───────────────────────────────────────────────────

test.describe('Home page — mobile (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('mobile brand bar is visible', async ({ page }) => {
    await page.goto('/')
    const brandLink = page.getByRole('link', { name: 'SnackSpot home' })
    await expect(brandLink).toBeVisible()
  })

  test('bottom nav is visible and spans full width', async ({ page }) => {
    await page.goto('/')
    const nav = page.locator('nav').filter({ hasText: 'Create new post' })
    await expect(nav).toBeVisible()
    const box = await nav.boundingBox()
    // At 390px the nav should span at least 300px wide
    expect(box?.width).toBeGreaterThan(300)
  })

  test('page heading is visible without horizontal scroll', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

// ─── Desktop-specific checks ──────────────────────────────────────────────────

test.describe('Home page — desktop (1280 px)', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('desktop footer with Guides link is visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Guides' })).toBeVisible()
  })

  test('desktop footer shows copyright notice', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('footer')).toContainText('SnackSpot')
  })
})
