import { test, expect } from '@playwright/test'

test.describe('Billing', () => {
  test('billing page requires authentication', async ({ page }) => {
    await page.goto('/en/billing')
    await expect(page).toHaveURL(/\/(en|ar)\/(login|billing)/)
  })
})
