'use client'

import { motion } from 'framer-motion'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  Tooltip as RechartsTooltip,
} from 'recharts'

import { formatSAR } from '@/lib/bookkeeper/calculations'
import type { CategoryBreakdownItem, MonthlyTrendItem, CashFlowPoint } from '@/lib/bookkeeper/calculations'
import type { TransactionCategory } from '@/lib/supabase/types'

const CHART_THEME = {
  gridColor: '#33334a',
  textColor: '#8888a8',
  tooltipBg: 'var(--color-card)',
  tooltipBorder: '#33334a',
}

const CATEGORY_LABEL_MAP: Record<TransactionCategory, { en: string; ar: string }> = {
  REVENUE: { en: 'Revenue', ar: 'إيرادات' },
  OTHER_INCOME: { en: 'Other Income', ar: 'إيرادات أخرى' },
  GOVERNMENT: { en: 'Government', ar: 'حكومي' },
  SALARY: { en: 'Salaries', ar: 'رواتب' },
  RENT: { en: 'Rent', ar: 'إيجار' },
  UTILITIES: { en: 'Utilities', ar: 'مرافق' },
  SUPPLIES: { en: 'Supplies', ar: 'مستلزمات' },
  TRANSPORT: { en: 'Transport', ar: 'نقل' },
  MARKETING: { en: 'Marketing', ar: 'تسويق' },
  PROFESSIONAL: { en: 'Professional', ar: 'مهني' },
  INSURANCE: { en: 'Insurance', ar: 'تأمين' },
  BANK_FEES: { en: 'Bank Fees', ar: 'بنكية' },
  OTHER_EXPENSE: { en: 'Other', ar: 'أخرى' },
}

interface BookkeeperChartsProps {
  locale: string
  sarLabel: string
  categoryBreakdown: CategoryBreakdownItem[]
  totalExpenses: number
  monthlyTrend: MonthlyTrendItem[]
  cashFlow: CashFlowPoint[]
}

export default function BookkeeperCharts({
  locale,
  sarLabel,
  categoryBreakdown,
  totalExpenses,
  monthlyTrend,
  cashFlow,
}: BookkeeperChartsProps) {
  return (
    <>
      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category Breakdown - Donut Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-border bg-card p-5"
        >
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            {locale === 'ar' ? 'توزيع المصروفات' : 'Expense Breakdown'}
          </h3>
          {categoryBreakdown.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
              {locale === 'ar' ? 'لا توجد بيانات للفترة المحددة' : 'No data for selected period'}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="relative h-52 w-52 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="amount"
                      strokeWidth={0}
                    >
                      {categoryBreakdown.map((entry) => (
                        <Cell key={entry.category} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null
                        const data = payload[0].payload as { category: TransactionCategory; amount: number }
                        return (
                          <div className="rounded-lg border border-border bg-surface-1 px-3 py-2 text-xs shadow-xl">
                            <p className="font-medium text-foreground">
                              {CATEGORY_LABEL_MAP[data.category][locale === 'ar' ? 'ar' : 'en']}
                            </p>
                            <p className="text-muted-foreground" dir="ltr">
                              {formatSAR(data.amount)} {sarLabel}
                            </p>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Label */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-xs text-muted-foreground">
                    {locale === 'ar' ? 'الإجمالي' : 'Total'}
                  </p>
                  <p className="text-base font-bold tabular-nums text-foreground" dir="ltr">
                    {formatSAR(totalExpenses)}
                  </p>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {categoryBreakdown.slice(0, 8).map((item) => (
                  <div key={item.category} className="flex items-center gap-1.5">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {CATEGORY_LABEL_MAP[item.category][locale === 'ar' ? 'ar' : 'en']}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Monthly Trend - Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border border-border bg-card p-5"
        >
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            {locale === 'ar' ? 'الاتجاه الشهري' : 'Monthly Trend'}
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} barGap={4}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_THEME.gridColor}
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                  width={40}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: CHART_THEME.tooltipBg,
                    border: `1px solid ${CHART_THEME.tooltipBorder}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#e8e8f0' }}
                  formatter={(value, name) => [
                    `${formatSAR(Number(value))} ${sarLabel}`,
                    name === 'income'
                      ? (locale === 'ar' ? 'الإيرادات' : 'Income')
                      : (locale === 'ar' ? 'المصروفات' : 'Expenses'),
                  ]}
                />
                <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Inline Legend */}
          <div className="mt-3 flex items-center justify-center gap-6">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">
                {locale === 'ar' ? 'الإيرادات' : 'Income'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="text-xs text-muted-foreground">
                {locale === 'ar' ? 'المصروفات' : 'Expenses'}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Cash Flow Chart - Full Width */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="rounded-xl border border-border bg-card p-5"
      >
        <h3 className="mb-4 text-sm font-semibold text-foreground">
          {locale === 'ar' ? 'التدفق النقدي' : 'Cash Flow'}
        </h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cashFlow}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5b5bff" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#5b5bff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_THEME.gridColor}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) => {
                  const d = new Date(v)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                width={45}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: CHART_THEME.tooltipBg,
                  border: `1px solid ${CHART_THEME.tooltipBorder}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#e8e8f0' }}
                formatter={(value) => [
                  `${formatSAR(Number(value))} ${sarLabel}`,
                  locale === 'ar' ? 'الرصيد' : 'Balance',
                ]}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#5b5bff"
                strokeWidth={2}
                fill="url(#balanceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </>
  )
}
