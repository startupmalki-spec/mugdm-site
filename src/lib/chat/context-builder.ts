import { createClient } from '@/lib/supabase/server'

interface BusinessInfo {
  name_ar: string
  name_en: string | null
  cr_number: string
  activity_type: string | null
  city: string | null
  cr_expiry_date: string | null
}

interface DocInfo {
  type: string
  expiry_date: string | null
  is_current: boolean
}

interface ObligationInfo {
  name: string
  type: string
  next_due_date: string
  frequency: string
}

interface TxnInfo {
  amount: number
  type: string
  date?: string
  category?: string
  description?: string
  vendor_or_client?: string
}

interface TeamInfo {
  name?: string
  nationality: string | null
  role?: string | null
  status: string
}

interface RecurringPattern {
  vendor_or_client: string
  avg_amount: number
  count: number
}

/**
 * Builds a concise business context string for the Claude system prompt.
 * Queries business data, documents, obligations, transactions, and team info.
 */
export async function buildBusinessContext(
  businessId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const [
    businessResult,
    documentStatsResult,
    obligationsResult,
    transactionsResult,
    recentTransactionsResult,
    teamResult,
    recurringResult,
  ] = await Promise.all([
    supabase
      .from('businesses')
      .select('name_ar, name_en, cr_number, activity_type, city, cr_expiry_date')
      .eq('id', businessId)
      .single(),

    supabase
      .from('documents')
      .select('type, expiry_date, is_current')
      .eq('business_id', businessId)
      .eq('is_current', true),

    supabase
      .from('obligations')
      .select('name, type, next_due_date, frequency')
      .eq('business_id', businessId)
      .gte('next_due_date', new Date().toISOString().split('T')[0])
      .order('next_due_date', { ascending: true })
      .limit(5),

    supabase
      .from('transactions')
      .select('amount, type')
      .eq('business_id', businessId)
      .gte('date', getMonthStart())
      .lte('date', getMonthEnd()),

    // Recent 5 transactions with details
    supabase
      .from('transactions')
      .select('amount, type, date, category, description, vendor_or_client')
      .eq('business_id', businessId)
      .order('date', { ascending: false })
      .limit(5),

    supabase
      .from('team_members')
      .select('name, nationality, role, status')
      .eq('business_id', businessId)
      .eq('status', 'ACTIVE'),

    // Recurring expense patterns: vendors with 3+ transactions
    supabase
      .from('transactions')
      .select('vendor_or_client, amount, type')
      .eq('business_id', businessId)
      .eq('type', 'EXPENSE')
      .not('vendor_or_client', 'is', null),
  ])

  const sections: string[] = []

  // Business info
  const biz = businessResult.data as BusinessInfo | null
  if (biz) {
    const name = biz.name_en || biz.name_ar
    sections.push(
      `Business: ${name} (CR: ${biz.cr_number})` +
      (biz.activity_type ? `, Activity: ${biz.activity_type}` : '') +
      (biz.city ? `, City: ${biz.city}` : '') +
      (biz.cr_expiry_date ? `, CR Expiry: ${biz.cr_expiry_date}` : '')
    )
  }

  // Document stats
  const docs = (documentStatsResult.data ?? []) as DocInfo[]
  if (docs.length > 0) {
    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

    const typeCounts: Record<string, number> = {}
    let valid = 0
    let expiring = 0
    let expired = 0

    for (const doc of docs) {
      typeCounts[doc.type] = (typeCounts[doc.type] ?? 0) + 1
      if (!doc.expiry_date) {
        valid++
      } else if (doc.expiry_date < today) {
        expired++
      } else if (doc.expiry_date <= thirtyDaysFromNow) {
        expiring++
      } else {
        valid++
      }
    }

    const typeList = Object.entries(typeCounts)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ')

    sections.push(
      `Documents (${docs.length} total): ${typeList}` +
      ` | Status: ${valid} valid, ${expiring} expiring soon, ${expired} expired`
    )
  } else {
    sections.push('Documents: None uploaded')
  }

  // Obligations
  const obligations = (obligationsResult.data ?? []) as ObligationInfo[]
  if (obligations.length > 0) {
    const list = obligations
      .map((o) => `- ${o.name} (${o.type}, ${o.frequency}) due ${o.next_due_date}`)
      .join('\n')
    sections.push(`Upcoming obligations:\n${list}`)
  } else {
    sections.push('Upcoming obligations: None')
  }

  // Financial summary
  const txns = (transactionsResult.data ?? []) as TxnInfo[]
  if (txns.length > 0) {
    let income = 0
    let expenses = 0
    for (const t of txns) {
      if (t.type === 'INCOME') income += t.amount
      else expenses += t.amount
    }
    const net = income - expenses
    sections.push(
      `This month's finances: Income ${formatSAR(income)}, Expenses ${formatSAR(expenses)}, Net ${formatSAR(net)} (${txns.length} transactions)`
    )
  } else {
    sections.push('This month\'s finances: No transactions recorded')
  }

  // Recent 5 transactions
  const recentTxns = (recentTransactionsResult.data ?? []) as TxnInfo[]
  if (recentTxns.length > 0) {
    const list = recentTxns
      .map((t) => `- ${t.date} | ${t.type} | ${formatSAR(t.amount)} | ${t.category ?? 'N/A'} | ${t.description ?? t.vendor_or_client ?? 'N/A'}`)
      .join('\n')
    sections.push(`Recent transactions:\n${list}`)
  }

  // Team with names and roles (no salaries for privacy)
  const team = (teamResult.data ?? []) as TeamInfo[]
  if (team.length > 0) {
    const saudiCount = team.filter((m) => m.nationality === 'Saudi').length
    const ratio = team.length > 0 ? Math.round((saudiCount / team.length) * 100) : 0
    sections.push(
      `Team: ${team.length} active members, ${saudiCount} Saudi (${ratio}% Saudization)`
    )
    const memberList = team
      .map((m) => `- ${m.name ?? 'Unnamed'} (${m.role ?? 'No role'}, ${m.nationality ?? 'Unknown'})`)
      .join('\n')
    sections.push(`Team members:\n${memberList}`)
  } else {
    sections.push('Team: No members recorded')
  }

  // Recurring expense patterns
  const recurringRaw = (recurringResult.data ?? []) as { vendor_or_client: string; amount: number; type: string }[]
  if (recurringRaw.length > 0) {
    const vendorMap: Record<string, { total: number; count: number }> = {}
    for (const r of recurringRaw) {
      if (!r.vendor_or_client) continue
      const key = r.vendor_or_client
      if (!vendorMap[key]) vendorMap[key] = { total: 0, count: 0 }
      vendorMap[key].total += r.amount
      vendorMap[key].count++
    }
    const recurring: RecurringPattern[] = Object.entries(vendorMap)
      .filter(([, v]) => v.count >= 3)
      .map(([vendor, v]) => ({
        vendor_or_client: vendor,
        avg_amount: Math.round(v.total / v.count),
        count: v.count,
      }))
      .sort((a, b) => b.avg_amount - a.avg_amount)
      .slice(0, 5)

    if (recurring.length > 0) {
      const list = recurring
        .map((r) => `- ${r.vendor_or_client}: avg ${formatSAR(r.avg_amount)}/occurrence (${r.count} times)`)
        .join('\n')
      sections.push(`Recurring expenses detected:\n${list}`)
    }
  }

  return sections.join('\n\n')
}

/**
 * Builds a compact context string for the floating assistant (fewer tokens).
 * Includes only essential business info, headline financials, and urgent obligations.
 */
export async function buildCompactContext(
  businessId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const [businessResult, obligationsResult, transactionsResult, teamResult] =
    await Promise.all([
      supabase
        .from('businesses')
        .select('name_ar, name_en, cr_number, activity_type')
        .eq('id', businessId)
        .single(),

      supabase
        .from('obligations')
        .select('name, type, next_due_date')
        .eq('business_id', businessId)
        .gte('next_due_date', new Date().toISOString().split('T')[0])
        .order('next_due_date', { ascending: true })
        .limit(3),

      supabase
        .from('transactions')
        .select('amount, type')
        .eq('business_id', businessId)
        .gte('date', getMonthStart())
        .lte('date', getMonthEnd()),

      supabase
        .from('team_members')
        .select('nationality, status')
        .eq('business_id', businessId)
        .eq('status', 'ACTIVE'),
    ])

  const parts: string[] = []

  // Business name
  const biz = businessResult.data as BusinessInfo | null
  if (biz) {
    parts.push(`Business: ${biz.name_en || biz.name_ar} (CR: ${biz.cr_number})`)
  }

  // Financial headline
  const txns = (transactionsResult.data ?? []) as TxnInfo[]
  if (txns.length > 0) {
    let income = 0
    let expenses = 0
    for (const t of txns) {
      if (t.type === 'INCOME') income += t.amount
      else expenses += t.amount
    }
    parts.push(`Month: ${formatSAR(income)} in, ${formatSAR(expenses)} out`)
  }

  // Urgent obligations
  const obligations = (obligationsResult.data ?? []) as ObligationInfo[]
  if (obligations.length > 0) {
    const list = obligations.map((o) => `${o.name} due ${o.next_due_date}`).join(', ')
    parts.push(`Next deadlines: ${list}`)
  }

  // Saudization ratio
  const team = (teamResult.data ?? []) as TeamInfo[]
  if (team.length > 0) {
    const saudiCount = team.filter((m) => m.nationality === 'Saudi').length
    const ratio = Math.round((saudiCount / team.length) * 100)
    parts.push(`Team: ${team.length} members, ${ratio}% Saudization`)
  }

  return parts.join(' | ')
}

function getMonthStart(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function getMonthEnd(): string {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return lastDay.toISOString().split('T')[0]
}

function formatSAR(amount: number): string {
  return `SAR ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
