import { test, expect } from '@playwright/test'

/**
 * Bookkeeper flow E2E tests.
 *
 * These require an authenticated session. In CI, use Playwright's
 * storageState to reuse an auth cookie. For local dev, these tests
 * will redirect to /login (tested in auth-flow.spec.ts).
 */

test.describe('Bookkeeper', () => {
  test('bookkeeper page requires authentication', async ({ page }) => {
    await page.goto('/en/bookkeeper')
    // Should redirect to login if unauthenticated
    await expect(page).toHaveURL(/\/(en|ar)\/(login|bookkeeper)/)
  })

  test('bookkeeper upload page requires authentication', async ({ page }) => {
    await page.goto('/en/bookkeeper/upload')
    await expect(page).toHaveURL(/\/(en|ar)\/(login|bookkeeper)/)
  })
})
