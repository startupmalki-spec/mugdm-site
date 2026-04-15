/**
 * Diagnostic: probe every Wathq base URL with the configured WATHQ_API_KEY
 * and a single CR number. Prints a table; exits 0 if any base returns 2xx.
 *
 *   npm run wathq:check                  # uses default CR 7037584328
 *   npm run wathq:check -- 1010963557    # custom CR
 */
import { config as dotenvConfig } from 'dotenv'
import path from 'node:path'
// Load .env.local first (Next.js convention), fall back to .env.
dotenvConfig({ path: path.resolve(process.cwd(), '.env.local') })
dotenvConfig({ path: path.resolve(process.cwd(), '.env') })
import { probeWathqAccess } from '../src/lib/wathq/client'

const DEFAULT_CR = '7037584328'

function pad(s: string, n: number): string {
  if (s.length >= n) return s
  return s + ' '.repeat(n - s.length)
}

async function main() {
  const apiKey = (process.env.WATHQ_API_KEY ?? '').trim().replace(/^["']|["']$/g, '')
  if (!apiKey) {
    console.error('[wathq-check] WATHQ_API_KEY is not set in .env.local')
    process.exit(1)
  }
  const cr = (process.argv[2] ?? DEFAULT_CR).replace(/\s/g, '')
  if (!/^\d{10}$/.test(cr)) {
    console.error(`[wathq-check] CR must be 10 digits (got "${cr}")`)
    process.exit(1)
  }

  console.log(`[wathq-check] probing CR ${cr} with key ${apiKey.slice(0, 6)}…\n`)
  const rows = await probeWathqAccess(apiKey, cr)

  const baseW = Math.max(...rows.map((r) => r.base.length), 'Base URL'.length)
  console.log(`${pad('Base URL', baseW)}  Status  OK`)
  for (const r of rows) {
    console.log(`${pad(r.base, baseW)}  ${pad(String(r.status), 6)}  ${r.ok ? '✓' : '✗'}`)
  }

  const firstOk = rows.find((r) => r.ok)
  if (firstOk) {
    console.log(`\nFirst successful body excerpt (${firstOk.base}):`)
    console.log(firstOk.bodyExcerpt.slice(0, 400))
    process.exit(0)
  }

  console.log('\nNo base URL returned 2xx. First error body excerpt:')
  console.log(rows[0]?.bodyExcerpt.slice(0, 400) ?? '(none)')
  process.exit(2)
}

main().catch((e) => {
  console.error('[wathq-check] fatal:', e)
  process.exit(1)
})
