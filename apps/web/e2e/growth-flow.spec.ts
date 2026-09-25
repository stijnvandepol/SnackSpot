import { test, expect } from '@playwright/test'

/**
 * The contribution path end to end: a logged-out visitor who wants to review a place
 * registers and lands back on that place's review form, then saves and reports the place.
 *
 * Needs a running app with a database that has at least one place (the seed script is
 * enough). Creates a throwaway account per run.
 */
test.describe('Growth flow — register and return', () => {
  test('keeps the destination through registration, then saves and reports a place', async ({ page }) => {
    // Any reviewed place: the sitemap lists them server-side, so no client fetch to wait on.
    const sitemap = await (await page.request.get('/sitemap.xml')).text()
    const placeId = sitemap.match(/\/place\/([^<?#]+)</)?.[1]
    test.skip(!placeId, 'No reviewed places in this database')

    await page.goto(`/add-review?placeId=${placeId}`)
    await page.getByRole('link', { name: 'Gratis account maken' }).click()
    await expect(page).toHaveURL(/\/auth\/register\?next=/)

    const username = `e2e${Date.now().toString(36)}`
    await page.getByLabel('E-mailadres').fill(`${username}@example.com`)
    await page.getByLabel('Gebruikersnaam').fill(username)
    await page.getByLabel('Wachtwoord').fill('Geheim123')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Account aanmaken' }).click()

    // Back where they started, not on the homepage.
    await expect(page).toHaveURL(new RegExp(`/add-review\\?placeId=${placeId}`))

    await page.goto(`/place/${placeId}`)
    await page.getByRole('button', { name: /Bewaren/ }).click()
    await expect(page.getByRole('button', { name: /Bewaard/ })).toBeVisible()

    await page.getByText('Klopt er iets niet aan deze zaak?').click()
    await page.getByLabel('Deze zaak is gesloten').check()
    await page.getByRole('button', { name: 'Doorgeven' }).click()
    await expect(page.getByText('Bedankt!')).toBeVisible()

    await page.goto('/profile?tab=saved')
    await expect(page.locator(`a[href^="/place/${placeId}"]`).first()).toBeVisible()
  })

  test('rejects an off-site next parameter', async ({ page }) => {
    await page.goto('/auth/login?next=//evil.example')
    const registerLink = page.getByRole('link', { name: 'Maak er gratis een' })
    await expect(registerLink).toHaveAttribute('href', '/auth/register')
  })
})
