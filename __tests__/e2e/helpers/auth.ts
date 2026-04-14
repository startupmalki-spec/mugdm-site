import type { Page } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function requireCreds(): { email: string; password: string } {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Authed e2e tests require E2E_EMAIL and E2E_PASSWORD')
  }
  return { email: EMAIL, password: PASSWORD }
}

interface GoTrueSession {
  access_token: string
  refresh_token: string
  expires_at: number
  expires_in: number
  token_type: string
  user: unknown
}

async function fetchSession(): Promise<GoTrueSession> {
  const { email, password } = requireCreds()
  if (!SUPABASE_URL || !ANON_KEY) throw new Error('Missing SUPABASE env vars')
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    },
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GoTrue sign-in failed ${res.status}: ${body}`)
  }
  return (await res.json()) as GoTrueSession
}

/**
 * Directly call Supabase GoTrue, then inject the session cookie in the format
 * that @supabase/ssr (v0.5+) expects: `base64-` + base64(JSON).
 */
export async function signIn(page: Page): Promise<void> {
  const session = await fetchSession()
  if (!SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
  const cookieName = `sb-${projectRef}-auth-token`

  const sessionStr = JSON.stringify(session)
  const b64 = 'base64-' + Buffer.from(sessionStr, 'utf8').toString('base64')

  await page.context().addCookies([
    {
      name: cookieName,
      value: b64,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
      expires: session.expires_at,
    },
  ])

  await page.goto('/en/dashboard')
  await page
    .waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 })
    .catch(() => {
      throw new Error('Auth did not persist — cookie format mismatch?')
    })
}
