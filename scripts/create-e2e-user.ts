/**
 * Create an auto-confirmed test user + seed a business for E2E tests.
 * Idempotent: if user exists, just prints creds; if business missing, creates it.
 *
 *   npx tsx scripts/create-e2e-user.ts
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Missing SUPABASE env vars')

const EMAIL = process.env.E2E_EMAIL || 'e2e-test@mugdm.test'
const PASSWORD = process.env.E2E_PASSWORD || 'E2ePass!' + 'secure-987'

const admin = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  let userId: string
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const existing = list.users.find((u) => u.email === EMAIL)
  if (existing) {
    userId = existing.id
    console.log(`[e2e-user] existing user ${EMAIL} (${userId})`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    })
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
    userId = data.user.id
    console.log(`[e2e-user] created ${EMAIL} (${userId})`)
  }

  const { data: biz } = await admin
    .from('businesses')
    .select('id, name_en')
    .eq('user_id', userId)
    .maybeSingle()

  if (!biz) {
    const { data: newBiz, error: bErr } = await admin
      .from('businesses')
      .insert({
        user_id: userId,
        name_en: 'E2E Test Co',
        name_ar: 'شركة الاختبار',
        cr_number: '1010000000',
        activity_type: 'IT services',
      })
      .select('id')
      .single()
    if (bErr) throw new Error(`insert business failed: ${bErr.message}`)
    console.log(`[e2e-user] created business ${newBiz.id}`)
  } else {
    console.log(`[e2e-user] existing business ${biz.id} (${biz.name_en})`)
  }

  // Persist to .env.local (idempotent replace).
  const envPath = path.resolve(process.cwd(), '.env.local')
  let env = readFileSync(envPath, 'utf8')
  const set = (k: string, v: string) => {
    if (new RegExp(`^${k}=`, 'm').test(env)) {
      env = env.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`)
    } else {
      env += `\n${k}=${v}`
    }
  }
  set('E2E_EMAIL', EMAIL)
  set('E2E_PASSWORD', PASSWORD)
  writeFileSync(envPath, env)
  console.log(`[e2e-user] wrote creds to .env.local`)
  console.log(`  E2E_EMAIL=${EMAIL}`)
  console.log(`  E2E_PASSWORD=${PASSWORD}`)
}

main().catch((e) => {
  console.error('[e2e-user] fatal:', e)
  process.exit(1)
})
