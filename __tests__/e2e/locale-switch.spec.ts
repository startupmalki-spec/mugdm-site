import { test, expect } from '@playwright/test'

test.describe('Locale Switching', () => {
  test('English page has dir="ltr"', async ({ page }) => {
    await page.goto('/en')
    const dir = await page.locator('html').getAttribute('dir')
    expect(dir).toBe('ltr')
  })

  test('Arabic page has dir="rtl"', async ({ page }) => {
    await page.goto('/ar')
    const dir = await page.locator('html').getAttribute('dir')
    expect(dir).toBe('rtl')
  })

  test('Arabic page uses Arabic lang attribute', async ({ page }) => {
    await page.goto('/ar')
    const lang = await page.locator('html').getAttribute('lang')
    expect(lang).toBe('ar')
  })

  test('English page uses English lang attribute', async ({ page }) => {
    await page.goto('/en')
    const lang = await page.locator('html').getAttribute('lang')
    expect(lang).toBe('en')
  })

  test('login page renders Arabic content at /ar/login', async ({ page }) => {
    await page.goto('/ar/login')
    // Should contain Arabic text somewhere on the page
    const bodyText = await page.locator('body').textContent()
    // Check for common Arabic characters
    expect(bodyText).toMatch(/[\u0600-\u06FF]/)
  })
})
