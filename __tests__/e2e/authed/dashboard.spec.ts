import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

test.describe('Authed: Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test('dashboard loads and shows stats', async ({ page }) => {
    await page.goto('/en/dashboard')
    await expect(page).toHaveURL(/\/en\/dashboard/)
    // Some heading should render — the dashboard always has at least an h1/h2.
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })

  test('sidebar nav links are present', async ({ page }) => {
    await page.goto('/en/dashboard')
    // The (app) layout sidebar contains links to the major modules.
    for (const href of ['/en/calendar', '/en/vault', '/en/bookkeeper', '/en/team', '/en/chat']) {
      await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible()
    }
  })
})
