import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

interface ActionResult {
  success: boolean
  message: string
}

// ── Transaction actions ────────────────────────────────────────────

export async function addTransaction(
  supabase: SupabaseClient,
  businessId: string,
  params: {
    date: string
    amount: number
    type: 'INCOME' | 'EXPENSE'
    category: string
    description: string
    vendor_or_client?: string
  }
): Promise<ActionResult> {
  if (!params.date || !params.amount || !params.type || !params.category || !params.description) {
    return { success: false, message: 'Missing required fields: date, amount, type, category, and description are all required.' }
  }

  if (params.amount <= 0) {
    return { success: false, message: 'Amount must be a positive number.' }
  }

  if (!['INCOME', 'EXPENSE'].includes(params.type)) {
    return { success: false, message: 'Type must be either INCOME or EXPENSE.' }
  }

  const payload = {
    business_id: businessId,
    date: params.date,
    amount: params.amount,
    type: params.type,
    category: params.category,
    description: params.description,
    vendor_or_client: params.vendor_or_client || null,
    source: 'AI_CHAT' as const,
    source_file_id: null,
    receipt_url: null,
    linked_obligation_id: null,
    vat_amount: null,
    ai_confidence: null,
    is_reviewed: false,
  }

  const { error } = await supabase
    .from('transactions')
    .insert(payload as never)

  if (error) {
    return { success: false, message: `Failed to add transaction: ${error.message}` }
  }

  const typeLabel = params.type === 'INCOME' ? 'income' : 'expense'
  const vendorPart = params.vendor_or_client ? ` ${params.type === 'EXPENSE' ? 'to' : 'from'} ${params.vendor_or_client}` : ''
  return {
    success: true,
    message: `Added ${typeLabel} of SAR ${params.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} for ${params.description}${vendorPart} on ${params.date}.`,
  }
}

// ── Team actions ───────────────────────────────────────────────────

export async function addTeamMember(
  supabase: SupabaseClient,
  businessId: string,
  params: {
    name: string
    nationality: string
    role?: string
    salary?: number
    start_date?: string
    iqama_number?: string
  }
): Promise<ActionResult> {
  if (!params.name || !params.nationality) {
    return { success: false, message: 'Missing required fields: name and nationality are required.' }
  }

  if (params.salary !== undefined && params.salary < 0) {
    return { success: false, message: 'Salary must be a non-negative number.' }
  }

  const payload = {
    business_id: businessId,
    name: params.name,
    nationality: params.nationality,
    role: params.role || null,
    salary: params.salary ?? null,
    start_date: params.start_date || new Date().toISOString().split('T')[0],
    iqama_number: params.iqama_number || null,
    status: 'ACTIVE' as const,
  }

  const { error } = await supabase
    .from('team_members')
    .insert(payload as never)

  if (error) {
    return { success: false, message: `Failed to add team member: ${error.message}` }
  }

  const rolePart = params.role ? ` as ${params.role}` : ''
  const salaryPart = params.salary ? ` with salary SAR ${params.salary.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''
  return {
    success: true,
    message: `Added team member ${params.name} (${params.nationality})${rolePart}${salaryPart}.`,
  }
}

export async function updateTeamMember(
  supabase: SupabaseClient,
  memberId: string,
  params: Partial<{
    salary: number
    role: string
    status: 'ACTIVE' | 'TERMINATED'
  }>
): Promise<ActionResult> {
  if (!memberId) {
    return { success: false, message: 'Member ID is required.' }
  }

  const updates: Record<string, unknown> = {}
  if (params.salary !== undefined) updates.salary = params.salary
  if (params.role !== undefined) updates.role = params.role
  if (params.status !== undefined) {
    updates.status = params.status
    if (params.status === 'TERMINATED') {
      updates.termination_date = new Date().toISOString().split('T')[0]
    }
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, message: 'No fields to update. Provide at least one of: salary, role, status.' }
  }

  const { error } = await supabase
    .from('team_members')
    .update(updates as never)
    .eq('id', memberId)

  if (error) {
    return { success: false, message: `Failed to update team member: ${error.message}` }
  }

  const parts: string[] = []
  if (params.role !== undefined) parts.push(`role to ${params.role}`)
  if (params.salary !== undefined) parts.push(`salary to SAR ${params.salary.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
  if (params.status !== undefined) parts.push(`status to ${params.status}`)

  return {
    success: true,
    message: `Updated team member: ${parts.join(', ')}.`,
  }
}

// ── Obligation actions ─────────────────────────────────────────────

export async function markObligationDone(
  supabase: SupabaseClient,
  obligationId: string
): Promise<ActionResult> {
  if (!obligationId) {
    return { success: false, message: 'Obligation ID is required.' }
  }

  // Fetch the obligation to get its details for the confirmation message and recurrence logic
  const { data: obligation, error: fetchError } = (await supabase
    .from('obligations')
    .select('id, name, frequency, next_due_date')
    .eq('id', obligationId)
    .single()) as unknown as { data: { id: string; name: string; frequency: string; next_due_date: string } | null; error: { message: string } | null }

  if (fetchError || !obligation) {
    return { success: false, message: fetchError ? `Failed to find obligation: ${fetchError.message}` : 'Obligation not found.' }
  }

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = {
    last_completed_at: now,
    reminder_30d_sent: false,
    reminder_15d_sent: false,
    reminder_7d_sent: false,
    reminder_1d_sent: false,
  }

  // Advance next_due_date for recurring obligations
  if (obligation.frequency !== 'ONE_TIME' && obligation.frequency !== 'CUSTOM') {
    const currentDue = new Date(obligation.next_due_date)
    let nextDate: Date

    switch (obligation.frequency) {
      case 'MONTHLY':
        nextDate = new Date(currentDue)
        nextDate.setMonth(nextDate.getMonth() + 1)
        break
      case 'QUARTERLY':
        nextDate = new Date(currentDue)
        nextDate.setMonth(nextDate.getMonth() + 3)
        break
      case 'ANNUAL':
        nextDate = new Date(currentDue)
        nextDate.setFullYear(nextDate.getFullYear() + 1)
        break
      default:
        nextDate = currentDue
    }

    updates.next_due_date = nextDate.toISOString().split('T')[0]
  }

  const { error } = await supabase
    .from('obligations')
    .update(updates as never)
    .eq('id', obligationId)

  if (error) {
    return { success: false, message: `Failed to mark obligation as done: ${error.message}` }
  }

  const nextPart = updates.next_due_date
    ? ` Next due date: ${updates.next_due_date}.`
    : ''
  return {
    success: true,
    message: `Marked "${obligation.name}" as completed.${nextPart}`,
  }
}

export async function addObligation(
  supabase: SupabaseClient,
  businessId: string,
  params: {
    name: string
    type: string
    frequency: string
    next_due_date: string
    description?: string
  }
): Promise<ActionResult> {
  if (!params.name || !params.type || !params.frequency || !params.next_due_date) {
    return { success: false, message: 'Missing required fields: name, type, frequency, and next_due_date are all required.' }
  }

  const payload = {
    business_id: businessId,
    name: params.name,
    type: params.type,
    frequency: params.frequency,
    next_due_date: params.next_due_date,
    description: params.description || null,
    last_completed_at: null,
    reminder_30d_sent: false,
    reminder_15d_sent: false,
    reminder_7d_sent: false,
    reminder_1d_sent: false,
    linked_document_id: null,
    notes: null,
  }

  const { error } = await supabase
    .from('obligations')
    .insert(payload as never)

  if (error) {
    return { success: false, message: `Failed to add obligation: ${error.message}` }
  }

  return {
    success: true,
    message: `Created obligation "${params.name}" (${params.type}, ${params.frequency}) due on ${params.next_due_date}.`,
  }
}

// ── Document actions ───────────────────────────────────────────────

export async function getDocumentSummary(
  supabase: SupabaseClient,
  businessId: string
): Promise<ActionResult> {
  const { data, error } = (await supabase
    .from('documents')
    .select('type, name, expiry_date, is_current, uploaded_at')
    .eq('business_id', businessId)
    .eq('is_current', true)
    .order('uploaded_at', { ascending: false })) as unknown as {
    data: Array<{ type: string; name: string; expiry_date: string | null; is_current: boolean; uploaded_at: string }> | null
    error: { message: string } | null
  }

  if (error) {
    return { success: false, message: `Failed to fetch documents: ${error.message}` }
  }

  const docs = data ?? []
  if (docs.length === 0) {
    return { success: true, message: 'No documents found for this business.' }
  }

  const today = new Date().toISOString().split('T')[0]
  const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  const lines: string[] = [`Found ${docs.length} current document(s):\n`]
  for (const doc of docs) {
    let status = 'valid'
    if (doc.expiry_date) {
      if (doc.expiry_date < today) status = 'EXPIRED'
      else if (doc.expiry_date <= thirtyDays) status = 'EXPIRING SOON'
    }
    const expiryPart = doc.expiry_date ? ` (expires: ${doc.expiry_date}, ${status})` : ' (no expiry)'
    lines.push(`- ${doc.name} [${doc.type}]${expiryPart}`)
  }

  return { success: true, message: lines.join('\n') }
}
