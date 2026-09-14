import { test, expect } from '@playwright/test'

test('guides live at /guides', async ({ page }) => {
  const res = await page.goto('/guides')
  expect(res?.status()).toBe(200)
  expect(page.url()).toMatch(/\/guides$/)
})

test('old /product/guides URL 301s to /guides', async ({ page }) => {
  const res = await page.goto('/product/guides')
  expect(res?.status()).toBe(200) // after redirect
  expect(page.url()).toMatch(/\/guides$/)
})

test('product page switches to Dutch and persists', async ({ page }) => {
  await page.goto('/product')
  await page.getByRole('button', { name: 'NL' }).click()
  await expect(page.getByRole('button', { name: 'NL' })).toHaveAttribute('aria-pressed', 'true')
  // a known Dutch string from the dict
  await expect(page.getByText('Je camera eet eerst')).toBeVisible()
})

test('product page renders 200 with hero visible', async ({ page }) => {
  const res = await page.goto('/product')
  expect(res?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('serves Dutch by default, without a language cookie', async ({ page }) => {
  // Googlebot carries no cookie and sends an en-US Accept-Language. The locale must not
  // be negotiated from that header: /product serves both languages from one URL, so the
  // indexable rendering has to be the same for everyone.
  await page.context().clearCookies()
  await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' })
  await page.goto('/product')

  await expect(page.locator('html')).toHaveAttribute('lang', 'nl')
  await expect(page.getByText('Je camera eet eerst')).toBeVisible()
})
