import type { Page } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD

export function requireCreds(): { email: string; password: string } {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      'Authed e2e tests require E2E_EMAIL and E2E_PASSWORD env vars'
    )
  }
  return { email: EMAIL, password: PASSWORD }
}

export async function signIn(page: Page): Promise<void> {
  const { email, password } = requireCreds()
  await page.goto('/en/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  // Wait for navigation off /login (either onboarding or dashboard).
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), {
    timeout: 15000,
  })
}
