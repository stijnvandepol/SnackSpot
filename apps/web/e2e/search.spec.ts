import { test, expect } from '@playwright/test'

test.describe('Search / Explore page', () => {
  test('loads with HTTP 200', async ({ page }) => {
    const res = await page.goto('/search')
    expect(res?.status()).toBe(200)
  })

  test('renders the Explore heading', async ({ page }) => {
    await page.goto('/search')
    await expect(page.getByRole('heading', { level: 1, name: 'Explore' })).toBeVisible()
  })

  test('has a search input', async ({ page }) => {
    await page.goto('/search')
    await expect(page.getByRole('searchbox', { name: 'Search places or dishes' })).toBeVisible()
  })

  test('Search button is disabled when the input is empty', async ({ page }) => {
    await page.goto('/search')
    await expect(page.getByRole('button', { name: 'Search' })).toBeDisabled()
  })

  test('Search button is enabled after typing a query', async ({ page }) => {
    await page.goto('/search')
    await page.getByRole('searchbox', { name: 'Search places or dishes' }).fill('pizza')
    await expect(page.getByRole('button', { name: 'Search' })).toBeEnabled()
  })

  test('shows all tag filter buttons', async ({ page }) => {
    await page.goto('/search')
    const tags = ['Budget spot', 'Street food', 'Late night', 'Local favorite', 'Worth the detour']
    for (const tag of tags) {
      await expect(page.getByRole('button', { name: tag })).toBeVisible()
    }
  })

  test('tag buttons start with aria-pressed="false"', async ({ page }) => {
    await page.goto('/search')
    await expect(page.getByRole('button', { name: 'Budget spot' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('clicking a tag sets aria-pressed="true"', async ({ page }) => {
    await page.goto('/search')
    const tagBtn = page.getByRole('button', { name: 'Budget spot' })
    await tagBtn.click()
    await expect(tagBtn).toHaveAttribute('aria-pressed', 'true')
  })

  test('clicking an active tag deactivates it', async ({ page }) => {
    await page.goto('/search')
    const tagBtn = page.getByRole('button', { name: 'Budget spot' })
    await tagBtn.click()
    await expect(tagBtn).toHaveAttribute('aria-pressed', 'true')
    await tagBtn.click()
    await expect(tagBtn).toHaveAttribute('aria-pressed', 'false')
  })

  test('Reset button appears after typing a query', async ({ page }) => {
    await page.goto('/search')
    await page.getByRole('searchbox', { name: 'Search places or dishes' }).fill('fries')
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible()
  })

  test('Reset button clears the search input', async ({ page }) => {
    await page.goto('/search')
    const input = page.getByRole('searchbox', { name: 'Search places or dishes' })
    await input.fill('fries')
    await page.getByRole('button', { name: 'Reset' }).click()
    await expect(input).toHaveValue('')
  })
})

// ─── Mobile-specific ─────────────────────────────────────────────────────────

test.describe('Search page — mobile (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('search input is visible and takes full available width', async ({ page }) => {
    await page.goto('/search')
    const input = page.getByRole('searchbox', { name: 'Search places or dishes' })
    await expect(input).toBeVisible()
    const box = await input.boundingBox()
    expect(box?.width).toBeGreaterThan(280)
  })

  test('tag pills are horizontally scrollable', async ({ page }) => {
    await page.goto('/search')
    // Tag container exists and is visible — overflow-x-auto container
    const tagRow = page.locator('.overflow-x-auto')
    await expect(tagRow).toBeVisible()
  })

  test('keyboard shortcut tip is not shown on mobile', async ({ page }) => {
    await page.goto('/search')
    await expect(page.getByText('Tip: press / to focus search.')).toBeHidden()
  })
})

// ─── Desktop-specific ────────────────────────────────────────────────────────

test.describe('Search page — desktop (1280 px)', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('keyboard shortcut tip is shown on desktop', async ({ page }) => {
    await page.goto('/search')
    await expect(page.getByText('Tip: press / to focus search.')).toBeVisible()
  })

  test('pressing / focuses the search input', async ({ page }) => {
    await page.goto('/search')
    // Click somewhere neutral first to ensure the input is not focused
    await page.locator('h1').click()
    await page.keyboard.press('/')
    const input = page.getByRole('searchbox', { name: 'Search places or dishes' })
    await expect(input).toBeFocused()
  })

  test('pressing Escape while search is focused clears and blurs it', async ({ page }) => {
    await page.goto('/search')
    const input = page.getByRole('searchbox', { name: 'Search places or dishes' })
    await input.fill('something')
    await input.press('Escape')
    await expect(input).toHaveValue('')
  })
})
