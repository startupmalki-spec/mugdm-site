import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createClient } from '@/lib/supabase/server'
import { Upload } from 'lucide-react'
import BillsList, { type BillRow } from '@/components/bookkeeper/BillsList'
import type { Bill, Vendor } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

const FEATURE_BILLS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_BILLS === 'true'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function BillsPage({ params }: PageProps) {
  const { locale } = await params
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

  // Resolve current business (owner-only v1).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let bills: BillRow[] = []
  let vendors: Pick<Vendor, 'id' | 'name_ar' | 'name_en'>[] = []
  let businessId = ''

  if (user) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (biz?.id) {
      businessId = biz.id
      const { data: billRows } = await supabase
        .from('bills')
        .select(
          'id,business_id,vendor_id,bill_number,issue_date,due_date,subtotal,vat_amount,vat_rate,total,currency,status,notes,created_at,updated_at,vendors(id,name_ar,name_en)'
        )
        .eq('business_id', biz.id)
        .order('due_date', { ascending: true })

      bills = ((billRows ?? []) as unknown as (Bill & {
        vendors: Pick<Vendor, 'id' | 'name_ar' | 'name_en'> | null
      })[]).map((b) => ({
        id: b.id,
        bill_number: b.bill_number,
        issue_date: b.issue_date,
        due_date: b.due_date,
        subtotal: Number(b.subtotal),
        vat_amount: Number(b.vat_amount),
        total: Number(b.total),
        currency: b.currency,
        status: b.status,
        vendor_id: b.vendor_id,
        vendor_name_ar: b.vendors?.name_ar ?? null,
        vendor_name_en: b.vendors?.name_en ?? null,
      }))

      const { data: vendorRows } = await supabase
        .from('vendors')
        .select('id,name_ar,name_en')
        .eq('business_id', biz.id)
        .order('name_en', { ascending: true })

      vendors = (vendorRows ?? []) as Pick<Vendor, 'id' | 'name_ar' | 'name_en'>[]
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href="/bookkeeper/bills/bulk"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-3"
        >
          <Upload className="h-4 w-4" />
          {t('bulk.linkLabel')}
        </Link>
      </div>
      <BillsList bills={bills} vendors={vendors} businessId={businessId} />
    </div>
  )
}
