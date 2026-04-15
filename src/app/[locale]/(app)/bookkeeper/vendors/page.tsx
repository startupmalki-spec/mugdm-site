import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createClient } from '@/lib/supabase/server'
import VendorAnalytics, {
  type VendorAnalyticsRow,
} from '@/components/bookkeeper/VendorAnalytics'

export const dynamic = 'force-dynamic'

const FEATURE_BILLS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_BILLS === 'true'

interface PageProps {
  params: Promise<{ locale: string }>
}

type VendorRow = {
  id: string
  name_ar: string | null
  name_en: string | null
}

type PaidBillRow = {
  id: string
  vendor_id: string
  issue_date: string
  total: number | string
  paid_at: string | null
}

export default async function VendorsPage({ params }: PageProps) {
  const { locale } = await params
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

  let rows: VendorAnalyticsRow[] = []

  if (user) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (biz?.id) {
      const { data: vendors } = await supabase
        .from('vendors')
        .select('id,name_ar,name_en')
        .eq('business_id', biz.id)

      const vendorList = (vendors ?? []) as VendorRow[]

      const { data: bills } = await supabase
        .from('bills')
        .select('id,vendor_id,issue_date,total,paid_at,status')
        .eq('business_id', biz.id)
        .eq('status', 'paid')

      const paidBills = ((bills ?? []) as unknown as PaidBillRow[]).filter(
        (b) => b.paid_at !== null,
      )

      // Aggregate per vendor in JS (JS reduce — simpler & RLS-safe).
      const agg = new Map<
        string,
        { total: number; count: number; lastPaid: string | null; cycleSum: number; cycleN: number }
      >()
      for (const b of paidBills) {
        const current = agg.get(b.vendor_id) ?? {
          total: 0,
          count: 0,
          lastPaid: null,
          cycleSum: 0,
          cycleN: 0,
        }
        current.total += Number(b.total) || 0
        current.count += 1
        if (b.paid_at && (!current.lastPaid || b.paid_at > current.lastPaid)) {
          current.lastPaid = b.paid_at
        }
        if (b.paid_at && b.issue_date) {
          const issued = new Date(b.issue_date).getTime()
          const paid = new Date(b.paid_at).getTime()
          if (Number.isFinite(issued) && Number.isFinite(paid) && paid >= issued) {
            current.cycleSum += Math.round((paid - issued) / (1000 * 60 * 60 * 24))
            current.cycleN += 1
          }
        }
        agg.set(b.vendor_id, current)
      }

      rows = vendorList.map((v) => {
        const a = agg.get(v.id)
        return {
          id: v.id,
          name_ar: v.name_ar,
          name_en: v.name_en,
          totalSpend: a?.total ?? 0,
          billCount: a?.count ?? 0,
          lastPaid: a?.lastPaid ?? null,
          avgCycleDays: a && a.cycleN > 0 ? Math.round(a.cycleSum / a.cycleN) : null,
        }
      })

      rows.sort((x, y) => y.totalSpend - x.totalSpend)
    }
  }

  return <VendorAnalytics rows={rows} />
}
