import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

test.describe('Authed: Invoicing', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test('customers list renders', async ({ page }) => {
    const response = await page.goto('/en/invoicing/customers')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })

  test('new customer form renders', async ({ page }) => {
    const response = await page.goto('/en/invoicing/customers/new')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('input[name="name"], input[id="name"]').first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('invoices list renders', async ({ page }) => {
    const response = await page.goto('/en/invoicing/invoices')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })

  test('new B2B invoice form renders', async ({ page }) => {
    const response = await page.goto('/en/invoicing/invoices/new')
    expect(response?.status()).toBeLessThan(500)
  })

  test('new B2C simplified invoice form renders', async ({ page }) => {
    const response = await page.goto('/en/invoicing/invoices/new-simplified')
    expect(response?.status()).toBeLessThan(500)
  })
})
