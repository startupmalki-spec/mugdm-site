/**
 * GET /api/cron/process-report-queue
 *
 * Periodic worker that drains the ZATCA B2C simplified-invoice reporting
 * queue (task 64). Called by Vercel Cron. Authorization mirrors
 * `/api/cron/check-cert-expiry`:
 *
 *   Authorization: Bearer ${CRON_SECRET}
 *
 * Response shape:
 *   { processed, succeeded, failed, deadLettered }
 */

import { NextResponse } from 'next/server'

import { processReportQueue } from '@/lib/invoicing/report-worker'

export async function GET(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  const provided = request.headers.get('authorization')

  if (!process.env.CRON_SECRET || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processReportQueue()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron/process-report-queue] failed:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
