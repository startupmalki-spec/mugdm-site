import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Link } from '@/i18n/routing'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createClient } from '@/lib/supabase/server'
import VendorDetailView from '@/components/bookkeeper/VendorDetailView'
import type { Bill, BillPayment, Vendor } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

const FEATURE_BILLS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_BILLS === 'true'

interface PageProps {
  params: Promise<{ locale: string; id: string }>
}

export default async function VendorDetailPage({ params }: PageProps) {
  const { locale, id } = await params
  await requireAuth(locale)

  const t = await getTranslations('bookkeeper.vendors')

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

  const { data: vendorRow } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!vendorRow) notFound()
  const vendor = vendorRow as unknown as Vendor

  const { data: biz } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', vendor.business_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!biz) notFound()

  const { data: billRows } = await supabase
    .from('bills')
    .select('*')
    .eq('vendor_id', id)
    .order('issue_date', { ascending: false })
  const bills = (billRows ?? []) as unknown as Bill[]

  const billIds = bills.map((b) => b.id)
  let payments: BillPayment[] = []
  if (billIds.length > 0) {
    const { data: paymentRows } = await supabase
      .from('bill_payments')
      .select('*')
      .in('bill_id', billIds)
      .order('paid_at', { ascending: false })
    payments = (paymentRows ?? []) as unknown as BillPayment[]
  }

  let totalSpend = 0
  let paidBillCount = 0
  let lastPaid: string | null = null
  let cycleSum = 0
  let cycleN = 0
  for (const b of bills) {
    if (b.status === 'paid') {
      totalSpend += Number(b.total) || 0
      paidBillCount += 1
      if (b.paid_at && (!lastPaid || b.paid_at > lastPaid)) lastPaid = b.paid_at
      if (b.paid_at && b.issue_date) {
        const issued = new Date(b.issue_date).getTime()
        const paid = new Date(b.paid_at).getTime()
        if (Number.isFinite(issued) && Number.isFinite(paid) && paid >= issued) {
          cycleSum += Math.round((paid - issued) / (1000 * 60 * 60 * 24))
          cycleN += 1
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/bookkeeper/vendors"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t('backToVendors')}
      </Link>
      <VendorDetailView
        vendor={vendor}
        bills={bills}
        payments={payments}
        summary={{
          totalSpend,
          billCount: bills.length,
          paidBillCount,
          lastPaid,
          avgCycleDays: cycleN > 0 ? Math.round(cycleSum / cycleN) : null,
        }}
      />
    </div>
  )
}
