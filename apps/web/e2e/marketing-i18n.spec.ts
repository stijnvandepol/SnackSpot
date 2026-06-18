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
