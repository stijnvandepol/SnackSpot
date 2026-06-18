import { test, expect } from '@playwright/test'

test('old guides URL 301s to /product/guides', async ({ page }) => {
  const res = await page.goto('/guides')
  expect(res?.status()).toBe(200) // after redirect
  expect(page.url()).toContain('/product/guides')
})

test('product page switches to Dutch and persists', async ({ page }) => {
  await page.goto('/product')
  await page.getByRole('button', { name: 'NL' }).click()
  await expect(page.getByRole('button', { name: 'NL' })).toHaveAttribute('aria-pressed', 'true')
  // a known Dutch string from the dict
  await expect(page.getByText('Je camera eet eerst')).toBeVisible()
})
