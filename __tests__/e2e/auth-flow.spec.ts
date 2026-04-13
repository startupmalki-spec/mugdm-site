import { test, expect } from '@playwright/test'

test.describe('Auth Flow', () => {
  test('unauthenticated user on /dashboard is redirected to /login', async ({ page }) => {
    await page.goto('/en/dashboard')
    await expect(page).toHaveURL(/\/en\/login/)
  })

  test('landing page loads without auth', async ({ page }) => {
    await page.goto('/en')
    await expect(page.locator('body')).toBeVisible()
    // Hero section should render
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('login page renders email input and submit button', async ({ page }) => {
    await page.goto('/en/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('terms and privacy pages are publicly accessible', async ({ page }) => {
    await page.goto('/en/terms')
    await expect(page).toHaveURL(/\/en\/terms/)

    await page.goto('/en/privacy')
    await expect(page).toHaveURL(/\/en\/privacy/)
  })
})
