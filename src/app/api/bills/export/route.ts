/**
 * GET /api/bills/export
 *
 * Export bills to an Excel (.xlsx) attachment.
 *
 * Query params (all optional, mirror the bills list):
 *   - businessId (required) — the business to export bills for
 *   - status     — CSV of statuses (e.g. "open,paid,overdue")
 *   - vendor     — ILIKE match on vendor_name
 *   - from       — inclusive lower bound on issue_date (YYYY-MM-DD)
 *   - to         — inclusive upper bound on issue_date (YYYY-MM-DD)
 *
 * Feature-flagged behind `NEXT_PUBLIC_FEATURE_BILLS === 'true'`.
 *
 * Returns: xlsx binary with Content-Disposition: attachment.
 * Errors : bilingual { error: { ar, en } } envelope.
 */

import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

import { createClient } from '@/lib/supabase/server'

function bilingualError(ar: string, en: string, status: number) {
  return NextResponse.json({ error: { ar, en } }, { status })
}

type BillRow = {
  bill_number: string | null
  vendor: { name_en: string | null; name_ar: string | null } | null
  issue_date: string | null
  due_date: string | null
  status: string | null
  subtotal: number | null
  vat_amount: number | null
  total: number | null
  currency: string | null
  paid_at: string | null
  notes: string | null
  bill_payments: Array<{ method: string | null }>
}

export async function GET(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_FEATURE_BILLS !== 'true') {
    return bilingualError(
      'ميزة الفواتير غير مفعّلة.',
      'Bills feature is not enabled.',
      404,
    )
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return bilingualError('غير مصرّح.', 'Unauthorized.', 401)
    }

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    if (!businessId) {
      return bilingualError(
        'معرّف النشاط التجاري مطلوب.',
        'businessId is required.',
        400,
      )
    }

    // Ownership check
    const { data: biz, error: bizErr } = await supabase
      .from('businesses')
      .select('id, name_ar, name_en')
      .eq('id', businessId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (bizErr || !biz) {
      return bilingualError(
        'النشاط التجاري غير موجود أو لا يخصّك.',
        'Business not found or not owned by current user.',
        404,
      )
    }
    const businessName = biz.name_en || biz.name_ar || 'Business'

    const statusRaw = searchParams.get('status')
    const vendor = (searchParams.get('vendor') ?? '').trim()
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')

    // `bills` table not yet in generated Supabase types — cast to any.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const untyped = supabase as any
    let query = untyped
      .from('bills')
      .select(
        'bill_number, issue_date, due_date, status, subtotal, vat_amount, total, currency, paid_at, notes, vendor:vendors(name_en, name_ar), bill_payments(method)',
      )
      .eq('business_id', businessId)
      .order('issue_date', { ascending: false })

    if (statusRaw) {
      const statuses = statusRaw
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0])
      } else if (statuses.length > 1) {
        query = query.in('status', statuses)
      }
    }
    if (vendor) {
      query = query.or(
        `name_en.ilike.%${vendor}%,name_ar.ilike.%${vendor}%`,
        { foreignTable: 'vendors' },
      )
    }
    if (dateFrom) query = query.gte('issue_date', dateFrom)
    if (dateTo) query = query.lte('issue_date', dateTo)

    const { data, error } = await query
    if (error) {
      return bilingualError(
        'تعذّر جلب الفواتير.',
        'Failed to fetch bills.',
        500,
      )
    }

    const rows = (data ?? []) as unknown as BillRow[]
    const buffer = await buildBillsWorkbook(rows, businessName)

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const filename = `bills-${today}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return bilingualError(
      'حدث خطأ غير متوقع.',
      'Unexpected error while exporting bills.',
      500,
    )
  }
}

async function buildBillsWorkbook(
  rows: BillRow[],
  businessName: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Mugdm Bookkeeper'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Bills')

  sheet.columns = [
    { header: 'Bill #', key: 'bill_number', width: 16 },
    { header: 'Vendor', key: 'vendor_name', width: 28 },
    { header: 'Issue Date', key: 'issue_date', width: 14 },
    { header: 'Due Date', key: 'due_date', width: 14 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Subtotal', key: 'subtotal', width: 14 },
    { header: 'VAT', key: 'vat_amount', width: 12 },
    { header: 'Total', key: 'total', width: 14 },
    { header: 'Currency', key: 'currency', width: 10 },
    { header: 'Paid Date', key: 'paid_date', width: 14 },
    { header: 'Payment Method', key: 'payment_method', width: 18 },
    { header: 'Notes', key: 'notes', width: 40 },
  ]

  for (const r of rows) {
    const vendorName = r.vendor?.name_en || r.vendor?.name_ar || ''
    const paidDate = r.paid_at ? r.paid_at.slice(0, 10) : ''
    const paymentMethod = r.bill_payments?.[0]?.method ?? ''
    sheet.addRow({
      bill_number: r.bill_number ?? '',
      vendor_name: vendorName,
      issue_date: r.issue_date ?? '',
      due_date: r.due_date ?? '',
      status: r.status ?? '',
      subtotal: r.subtotal ?? '',
      vat_amount: r.vat_amount ?? '',
      total: r.total ?? '',
      currency: r.currency ?? '',
      paid_date: paidDate,
      payment_method: paymentMethod,
      notes: r.notes ?? '',
    })
  }

  sheet.getColumn('subtotal').numFmt = '#,##0.00'
  sheet.getColumn('vat_amount').numFmt = '#,##0.00'
  sheet.getColumn('total').numFmt = '#,##0.00'

  // Title banner on row 1
  sheet.insertRow(1, [`${businessName} — Bills Export`])
  sheet.mergeCells('A1:L1')
  const titleRow = sheet.getRow(1)
  titleRow.font = { bold: true, size: 14 }
  titleRow.alignment = { horizontal: 'center' }

  // Restyle header row (now row 2)
  const headerRow = sheet.getRow(2)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1a1a2e' },
  }
  headerRow.alignment = { horizontal: 'center' }

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer as ArrayBuffer)
}
