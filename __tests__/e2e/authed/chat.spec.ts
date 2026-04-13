import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

test.describe('Authed: Chat', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test('chat page loads with input', async ({ page }) => {
    const response = await page.goto('/en/chat')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('textarea, input[type="text"]').first()).toBeVisible({
      timeout: 10000,
    })
  })
})
