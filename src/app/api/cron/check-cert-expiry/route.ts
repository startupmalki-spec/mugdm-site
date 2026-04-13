/**
 * GET /api/cron/check-cert-expiry
 *
 * Daily cron entry point that scans active ZATCA production certs nearing
 * expiry and upserts renewal obligations. Protected by `Authorization:
 * Bearer <CRON_SECRET>` — Vercel Cron sends this automatically when a
 * `vercel.json` cron entry references this path.
 */

import { NextResponse } from 'next/server'

import { checkAllExpiringCerts } from '@/lib/zatca/cert-monitor'

export async function GET(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  const provided = request.headers.get('authorization')

  if (!process.env.CRON_SECRET || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await checkAllExpiringCerts()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron/check-cert-expiry] failed:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
