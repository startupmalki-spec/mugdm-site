import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { Link } from '@/i18n/routing'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createClient } from '@/lib/supabase/server'
import BillDetail from '@/components/bookkeeper/BillDetail'
import type {
  Bill,
  BillAttachment,
  BillAuditLog,
  BillLineItem,
  BillPayment,
  Vendor,
} from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

const FEATURE_BILLS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_BILLS === 'true'

interface PageProps {
  params: Promise<{ locale: string; id: string }>
}

export default async function BillDetailPage({ params }: PageProps) {
  const { locale, id } = await params
  await requireAuth(locale)

  const t = await getTranslations('bookkeeper.bills')

  if (!FEATURE_BILLS_ENABLED) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-4 text-muted-foreground">{t('comingSoon')}</p>
        <Link
          href="/bookkeeper"
          className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {t('backToBookkeeper')}
        </Link>
      </div>
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  // Owner-scoped via RLS — but we double-check by joining business.
  const { data: billRow } = await supabase
    .from('bills')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!billRow) notFound()
  const bill = billRow as unknown as Bill

  const { data: biz } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', bill.business_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!biz) notFound()

  const [vendorRes, lineItemsRes, attachmentsRes, paymentsRes, auditRes] =
    await Promise.all([
      supabase
        .from('vendors')
        .select('*')
        .eq('id', bill.vendor_id)
        .maybeSingle(),
      supabase
        .from('bill_line_items')
        .select('*')
        .eq('bill_id', id)
        .order('line_order', { ascending: true }),
      supabase
        .from('bill_attachments')
        .select('*')
        .eq('bill_id', id)
        .order('uploaded_at', { ascending: false }),
      supabase
        .from('bill_payments')
        .select('*')
        .eq('bill_id', id)
        .order('paid_at', { ascending: false }),
      supabase
        .from('bill_audit_log')
        .select('*')
        .eq('bill_id', id)
        .order('created_at', { ascending: false }),
    ])

  const vendor = (vendorRes.data ?? null) as Vendor | null
  const lineItems = (lineItemsRes.data ?? []) as BillLineItem[]
  const attachments = (attachmentsRes.data ?? []) as BillAttachment[]
  const payments = (paymentsRes.data ?? []) as BillPayment[]
  const auditLog = (auditRes.data ?? []) as BillAuditLog[]

  return (
    <BillDetail
      bill={bill}
      vendor={vendor}
      lineItems={lineItems}
      attachments={attachments}
      payments={payments}
      auditLog={auditLog}
    />
  )
}
