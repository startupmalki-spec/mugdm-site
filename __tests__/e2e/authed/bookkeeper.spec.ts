import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

test.describe('Authed: Bookkeeper', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test('bookkeeper page renders', async ({ page }) => {
    const response = await page.goto('/en/bookkeeper')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })

  test('bookkeeper upload page renders', async ({ page }) => {
    const response = await page.goto('/en/bookkeeper/upload')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('input[type="file"]').first()).toBeVisible({
      timeout: 10000,
    })
  })
})
