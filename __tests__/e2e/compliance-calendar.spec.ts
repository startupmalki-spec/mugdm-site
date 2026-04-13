import { test, expect } from '@playwright/test'

test.describe('Compliance Calendar', () => {
  test('calendar page requires authentication', async ({ page }) => {
    await page.goto('/en/calendar')
    await expect(page).toHaveURL(/\/(en|ar)\/(login|calendar)/)
  })
})
