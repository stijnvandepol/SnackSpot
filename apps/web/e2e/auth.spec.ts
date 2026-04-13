import { test, expect } from '@playwright/test'

// ─── Login page ───────────────────────────────────────────────────────────────

test.describe('Login page', () => {
  test('loads with HTTP 200', async ({ page }) => {
    const res = await page.goto('/auth/login')
    expect(res?.status()).toBe(200)
  })

  test('renders the "Welcome back" heading and form fields', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByText('Welcome back')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
  })

  test('shows a link to the registration page', async ({ page }) => {
    await page.goto('/auth/login')
    const link = page.getByRole('link', { name: 'Sign up' })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/auth/register')
  })

  test('shows a link to the forgot-password page', async ({ page }) => {
    await page.goto('/auth/login')
    const link = page.getByRole('link', { name: 'Forgot password?' })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/auth/forgot-password')
  })

  test('submit button is enabled when form is filled', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Password').fill('password')
    await expect(page.getByRole('button', { name: 'Log in' })).toBeEnabled()
  })

  test('shows an error message on wrong credentials', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill('nobody@example.com')
    await page.getByLabel('Password').fill('wrongpassword123')
    await page.getByRole('button', { name: 'Log in' }).click()
    // Error div has red styling classes and shows the server error message
    await expect(page.locator('[class*="red-"]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('shows "Logging in…" while the request is in flight', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Password').fill('password')
    // Click without waiting for navigation so we can catch the in-flight state
    const btnClick = page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByRole('button', { name: 'Logging in…' })).toBeVisible({ timeout: 2_000 })
      .catch(() => { /* Response was too fast — that is fine */ })
    await btnClick
  })

  // ── Mobile ────────────────────────────────────────────────────────────────

  test.describe('Login page — mobile (390 px)', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('form is full-width and all fields are visible without scrolling', async ({ page }) => {
      await page.goto('/auth/login')
      await expect(page.getByLabel('Email')).toBeVisible()
      await expect(page.getByLabel('Password')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
      const form = page.locator('form')
      const box = await form.boundingBox()
      expect(box?.width).toBeGreaterThan(300)
    })

    test('email input uses type="email" for mobile keyboard', async ({ page }) => {
      await page.goto('/auth/login')
      await expect(page.getByLabel('Email')).toHaveAttribute('type', 'email')
    })

    test('password input uses type="password"', async ({ page }) => {
      await page.goto('/auth/login')
      await expect(page.getByLabel('Password')).toHaveAttribute('type', 'password')
    })
  })
})

// ─── Register page ────────────────────────────────────────────────────────────

test.describe('Register page', () => {
  test('loads with HTTP 200', async ({ page }) => {
    const res = await page.goto('/auth/register')
    expect(res?.status()).toBe(200)
  })

  test('shows a heading on the register page', async ({ page }) => {
    await page.goto('/auth/register')
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible()
  })

  test('shows a link back to the login page', async ({ page }) => {
    await page.goto('/auth/register')
    await expect(page.getByRole('link', { name: /log in/i })).toBeVisible()
  })
})

// ─── Session expiry banner ────────────────────────────────────────────────────

test.describe('Session expiry', () => {
  test('shows an expiry notice when ?expired=1 is in the URL', async ({ page }) => {
    await page.goto('/auth/login?expired=1')
    await expect(page.getByText(/session has expired/i)).toBeVisible()
  })
})

// ─── Successful login flow ────────────────────────────────────────────────────
// TODO: Fill in what a logged-in user should see after a successful login.
//
// The app:
//   - Desktop TopNav shows the first letter of username + "Log out" button
//   - Mobile BottomNav has the same 5 links (no user-specific change)
//   - After router.push('/') the URL changes to "/"
//   - The login form should no longer be visible
//
// Provide TEST_EMAIL and TEST_PASSWORD via environment variables, then
// implement the assertions below.

test.describe('Successful login flow', () => {
  test.skip(!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD, 'Set TEST_EMAIL and TEST_PASSWORD to run this test')

  test('redirects to home and shows user-specific UI after login', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill(process.env.TEST_EMAIL!)
    await page.getByLabel('Password').fill(process.env.TEST_PASSWORD!)
    await page.getByRole('button', { name: 'Log in' }).click()

    // TODO: Write the assertions that prove the login succeeded.
    //
    // Ideas to consider:
    //   - await expect(page).toHaveURL('/')                          ← redirect happened
    //   - await expect(page.locator('header')).not.toContainText('Log in')   ← no more login link on desktop
    //   - await expect(page.getByRole('link', { name: 'Open profile' })).toBeVisible()
    //   - await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
    //
    // What matters to YOU here? ↓
  })
})
