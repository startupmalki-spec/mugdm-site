'use client'

import { useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/routing'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Store } from 'lucide-react'

export interface VendorAnalyticsRow {
  id: string
  name_ar: string | null
  name_en: string | null
  totalSpend: number
  billCount: number
  lastPaid: string | null
  avgCycleDays: number | null
}

interface Props {
  rows: VendorAnalyticsRow[]
}

const PIE_COLORS = [
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#0ea5e9',
  '#a855f7',
  '#14b8a6',
  '#f43f5e',
]

function vendorDisplayName(
  v: Pick<VendorAnalyticsRow, 'name_ar' | 'name_en'>,
  locale: string,
): string {
  if (locale === 'ar') return v.name_ar || v.name_en || '—'
  return v.name_en || v.name_ar || '—'
}

function formatSAR(amount: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
      style: 'currency',
      currency: 'SAR',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${amount.toFixed(0)} SAR`
  }
}

export default function VendorAnalytics({ rows }: Props) {
  const t = useTranslations('bookkeeper.vendors')
  const locale = useLocale()
  const isRTL = locale === 'ar'

  const top5 = useMemo(
    () =>
      rows
        .slice(0, 5)
        .map((r) => ({ name: vendorDisplayName(r, locale), value: r.totalSpend })),
    [rows, locale],
  )

  const pieData = useMemo(() => {
    const top = rows.slice(0, 7)
    const rest = rows.slice(7)
    const restSum = rest.reduce((s, r) => s + r.totalSpend, 0)
    const base = top.map((r) => ({
      name: vendorDisplayName(r, locale),
      value: r.totalSpend,
    }))
    if (restSum > 0) {
      base.push({ name: locale === 'ar' ? 'أخرى' : 'Other', value: restSum })
    }
    return base.filter((d) => d.value > 0)
  }, [rows, locale])

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-surface-1 p-12 text-center">
          <Store className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">{t('emptyTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('emptySubtitle')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface-1 p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">{t('topSpend')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top5}
                layout="vertical"
                margin={{ top: 5, right: 16, bottom: 5, left: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#33334a" />
                <XAxis
                  type="number"
                  stroke="#8888a8"
                  tick={{ fontSize: 11 }}
                  reversed={isRTL}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#8888a8"
                  tick={{ fontSize: 11 }}
                  width={100}
                  orientation={isRTL ? 'right' : 'left'}
                />
                <RechartsTooltip
                  contentStyle={{
                    background: 'var(--color-card)',
                    border: '1px solid #33334a',
                  }}
                  formatter={(value) => formatSAR(Number(value) || 0, locale)}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-1 p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">{t('spendShare')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  wrapperStyle={{ fontSize: 11 }}
                />
                <RechartsTooltip
                  contentStyle={{
                    background: 'var(--color-card)',
                    border: '1px solid #33334a',
                  }}
                  formatter={(value) => formatSAR(Number(value) || 0, locale)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface-1">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t('vendor')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('totalSpend')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('billCount')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('lastPaid')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('avgCycle')}</th>
                <th className="px-4 py-3 text-end font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2/60">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {vendorDisplayName(r, locale)}
                  </td>
                  <td className="px-4 py-3 text-end font-mono text-foreground">
                    {formatSAR(r.totalSpend, locale)}
                  </td>
                  <td className="px-4 py-3 text-end text-muted-foreground">
                    {r.billCount}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.lastPaid ? r.lastPaid.slice(0, 10) : t('never')}
                  </td>
                  <td className="px-4 py-3 text-end text-muted-foreground">
                    {r.avgCycleDays !== null ? t('days', { n: r.avgCycleDays }) : t('never')}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Link
                      href={`/bookkeeper/vendors/${r.id}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {t('viewDetail')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
