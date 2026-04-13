import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

test.describe('Authed: Compliance Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test('calendar page renders without 5xx', async ({ page }) => {
    const response = await page.goto('/en/calendar')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })
})
