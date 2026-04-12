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
}

interface TeamInfo {
  nationality: string | null
  status: string
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
    teamResult,
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

    supabase
      .from('team_members')
      .select('nationality, status')
      .eq('business_id', businessId)
      .eq('status', 'ACTIVE'),
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

  // Team
  const team = (teamResult.data ?? []) as TeamInfo[]
  if (team.length > 0) {
    const saudiCount = team.filter((m) => m.nationality === 'Saudi').length
    const ratio = team.length > 0 ? Math.round((saudiCount / team.length) * 100) : 0
    sections.push(
      `Team: ${team.length} active members, ${saudiCount} Saudi (${ratio}% Saudization)`
    )
  } else {
    sections.push('Team: No members recorded')
  }

  return sections.join('\n\n')
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
