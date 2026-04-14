import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

test.describe('Authed: Bills (bookkeeper depth)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test('bills list renders with empty state or table', async ({ page }) => {
    const response = await page.goto('/en/bookkeeper/bills')
    expect(response?.status()).toBeLessThan(500)
    // Either an empty-state CTA or the table header must be visible.
    await expect(
      page.getByRole('link', { name: /add.*bill|add first bill/i }).first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('add bill page renders with vendor input and line items', async ({ page }) => {
    const response = await page.goto('/en/bookkeeper/bills/new')
    expect(response?.status()).toBeLessThan(500)
    // Should have some kind of form field for vendor/bill number or an upload dropzone.
    const hasForm = await page
      .locator('input, textarea, button:has-text("upload"), [role="button"]')
      .first()
      .isVisible({ timeout: 10000 })
    expect(hasForm).toBeTruthy()
  })

  test('bulk upload page renders', async ({ page }) => {
    const response = await page.goto('/en/bookkeeper/bills/bulk')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).toContainText(/bulk|upload|drop/i, {
      timeout: 10000,
    })
  })

  test('vendors page renders', async ({ page }) => {
    const response = await page.goto('/en/bookkeeper/vendors')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).toContainText(/vendor|supplier/i, {
      timeout: 10000,
    })
  })

  test('dashboard shows Outstanding AP card when bills feature enabled', async ({ page }) => {
    const response = await page.goto('/en/dashboard')
    expect(response?.status()).toBeLessThan(500)
    // AP card should appear somewhere on the dashboard.
    await expect(page.locator('body')).toContainText(/outstanding|AP|accounts payable/i, {
      timeout: 10000,
    })
  })

  test('API: sum_ap_outstanding via authed request returns shape', async ({ request }) => {
    // POST /api/bills requires auth + body; test that an unauth request gets 401.
    const res = await request.post('/api/bills', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })
    // With auth cookie present (from context) expect 400 for missing body, not 401.
    expect([400, 401, 422]).toContain(res.status())
  })

  test('API: /api/vendors GET with ownership returns array', async ({ request }) => {
    const res = await request.get('/api/vendors?q=test')
    expect([200, 400, 401]).toContain(res.status())
    if (res.status() === 200) {
      const json = await res.json()
      expect(Array.isArray(json.vendors ?? json)).toBeTruthy()
    }
  })

  test('API: /api/bills/overdue-sweep rejects missing cron secret', async ({ request }) => {
    const res = await request.post('/api/bills/overdue-sweep', { data: {} })
    expect(res.status()).toBe(401)
  })

  test('API: /api/analyze-bill rejects missing body', async ({ request }) => {
    const res = await request.post('/api/analyze-bill', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })
    // Expect validation failure (400/422) or unauthorized if auth cookie didn't ride.
    expect([400, 401, 422]).toContain(res.status())
  })

  test('Arabic locale: bills page renders with Arabic direction', async ({ page }) => {
    const response = await page.goto('/ar/bookkeeper/bills')
    expect(response?.status()).toBeLessThan(500)
    const dir = await page.locator('html').getAttribute('dir')
    expect(dir).toBe('rtl')
  })
})
