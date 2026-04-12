import Anthropic from '@anthropic-ai/sdk'

import { createClient } from '@/lib/supabase/server'
import { buildBusinessContext } from '@/lib/chat/context-builder'
import {
  addTransaction,
  addTeamMember,
  updateTeamMember,
  markObligationDone,
  addObligation,
  getDocumentSummary,
} from '@/lib/chat/actions'
import { importExcelData } from '@/lib/chat/excel-importer'
import { enforceRateLimit } from '@/lib/rate-limit-middleware'
import { selectModel } from '@/lib/ai/model-router'
import { trackUsage } from '@/lib/ai/usage-tracker'

interface ChatRequest {
  message: string
  conversationId?: string
  businessId: string
  mode?: 'chat' | 'advisory'
  /** When confirming a pending action */
  confirmAction?: {
    toolName: string
    toolInput: Record<string, unknown>
    confirmed: boolean
  }
}

/** Tools that modify data and require user confirmation */
const ACTION_TOOLS = new Set([
  'add_transaction',
  'add_team_member',
  'update_team_member',
  'mark_obligation_done',
  'add_obligation',
  'import_spreadsheet_data',
])

/** Tools that are destructive and require double confirmation */
const DESTRUCTIVE_TOOLS = new Set([
  'import_spreadsheet_data',
])

function formatActionSummary(
  toolName: string,
  toolInput: Record<string, unknown>
): string {
  switch (toolName) {
    case 'add_transaction': {
      const type = toolInput.type === 'INCOME' ? 'income' : 'expense'
      const amount = Number(toolInput.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })
      return `Add ${type} of SAR ${amount} for "${toolInput.description}" on ${toolInput.date}`
    }
    case 'add_team_member':
      return `Add team member "${toolInput.name}" (${toolInput.nationality})${toolInput.role ? ` as ${toolInput.role}` : ''}`
    case 'update_team_member': {
      const parts: string[] = []
      if (toolInput.role) parts.push(`role to ${toolInput.role}`)
      if (toolInput.salary) parts.push(`salary to SAR ${Number(toolInput.salary).toLocaleString()}`)
      if (toolInput.status) parts.push(`status to ${toolInput.status}`)
      return `Update team member: ${parts.join(', ')}`
    }
    case 'mark_obligation_done':
      return `Mark obligation as completed`
    case 'add_obligation':
      return `Add obligation "${toolInput.name}" (${toolInput.type}, ${toolInput.frequency}) due ${toolInput.next_due_date}`
    case 'import_spreadsheet_data':
      return `Import ${(toolInput.rows as unknown[])?.length ?? 0} rows as ${toolInput.dataType}`
    default:
      return `Execute ${toolName}`
  }
}

const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'query_transactions',
    description:
      'Query financial transactions for the business. Can filter by date range, type (INCOME/EXPENSE), category, or vendor/client name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date_from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        type: { type: 'string', enum: ['INCOME', 'EXPENSE'], description: 'Transaction type' },
        category: { type: 'string', description: 'Transaction category' },
        search: { type: 'string', description: 'Search in description or vendor/client' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'query_documents',
    description:
      'Query business documents. Can filter by type, expiry status, or search by name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', description: 'Document type (e.g., CR, GOSI_CERT, etc.)' },
        expiry_status: {
          type: 'string',
          enum: ['valid', 'expiring', 'expired'],
          description: 'Filter by expiry status',
        },
        search: { type: 'string', description: 'Search in document name' },
      },
      required: [],
    },
  },
  {
    name: 'query_obligations',
    description:
      'Query business obligations/compliance deadlines. Can filter by type, frequency, or upcoming due dates.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', description: 'Obligation type' },
        due_within_days: { type: 'number', description: 'Show obligations due within N days' },
        frequency: { type: 'string', description: 'Filter by frequency' },
      },
      required: [],
    },
  },
  {
    name: 'query_team',
    description:
      'Query team/employee information. Can filter by status, nationality, or role.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['ACTIVE', 'TERMINATED'], description: 'Employee status' },
        nationality: { type: 'string', description: 'Filter by nationality' },
        role: { type: 'string', description: 'Filter by role' },
      },
      required: [],
    },
  },
  // ── Action tools ─────────────────────────────────────────────────
  {
    name: 'add_transaction',
    description:
      'Add a new income or expense transaction to the bookkeeper. Always confirm the details with the user before calling this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Transaction date (YYYY-MM-DD)' },
        amount: { type: 'number', description: 'Transaction amount in SAR (positive number)' },
        type: { type: 'string', enum: ['INCOME', 'EXPENSE'], description: 'Transaction type' },
        category: { type: 'string', description: 'Transaction category (e.g., RENT, SALARY, SALES, SUPPLIES)' },
        description: { type: 'string', description: 'Description of the transaction' },
        vendor_or_client: { type: 'string', description: 'Vendor name (for expenses) or client name (for income)' },
      },
      required: ['date', 'amount', 'type', 'category', 'description'],
    },
  },
  {
    name: 'add_team_member',
    description:
      'Add a new team member/employee. Always confirm the details with the user before calling this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Full name of the team member' },
        nationality: { type: 'string', description: 'Nationality (e.g., Saudi, Indian, Filipino)' },
        role: { type: 'string', description: 'Job role/title' },
        salary: { type: 'number', description: 'Monthly salary in SAR' },
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD), defaults to today' },
        iqama_number: { type: 'string', description: 'Iqama (residence permit) number' },
      },
      required: ['name', 'nationality'],
    },
  },
  {
    name: 'update_team_member',
    description:
      'Update an existing team member\'s details (salary, role, or status). Use query_team first to find the member ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        member_id: { type: 'string', description: 'UUID of the team member to update' },
        salary: { type: 'number', description: 'New monthly salary in SAR' },
        role: { type: 'string', description: 'New job role/title' },
        status: { type: 'string', enum: ['ACTIVE', 'TERMINATED'], description: 'New status' },
      },
      required: ['member_id'],
    },
  },
  {
    name: 'mark_obligation_done',
    description:
      'Mark a compliance obligation as completed for the current period. For recurring obligations, this advances the next due date automatically.',
    input_schema: {
      type: 'object' as const,
      properties: {
        obligation_id: { type: 'string', description: 'UUID of the obligation to mark as done' },
      },
      required: ['obligation_id'],
    },
  },
  {
    name: 'add_obligation',
    description:
      'Create a new compliance obligation/deadline. Always confirm the details with the user before calling this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name of the obligation' },
        type: { type: 'string', description: 'Obligation type (e.g., TAX, GOSI, ZAKAT, LICENSE, VISA, CUSTOM)' },
        frequency: { type: 'string', enum: ['MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME', 'CUSTOM'], description: 'How often this obligation recurs' },
        next_due_date: { type: 'string', description: 'Next due date (YYYY-MM-DD)' },
        description: { type: 'string', description: 'Optional description or notes' },
      },
      required: ['name', 'type', 'frequency', 'next_due_date'],
    },
  },
  {
    name: 'get_document_summary',
    description:
      'Get a summary of all current business documents with their expiry status.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'import_spreadsheet_data',
    description:
      'Import parsed spreadsheet data into Mugdm. Use after analyzing an uploaded Excel/CSV file and getting user confirmation. Supports importing transactions, team members, or obligations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dataType: {
          type: 'string',
          enum: ['transactions', 'team_members', 'obligations'],
          description: 'Which Mugdm data type to import the rows as.',
        },
        rows: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of row objects with Excel column names as keys.',
        },
        columnMapping: {
          type: 'object',
          description:
            'Maps Excel column names to Mugdm field names. For transactions: date, amount, type, category, description, vendor_or_client. For team_members: name, nationality, role, salary, start_date, iqama_number. For obligations: name, type, frequency, next_due_date, description, notes.',
        },
      },
      required: ['dataType', 'rows', 'columnMapping'],
    },
  },
]

async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  businessId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  switch (toolName) {
    case 'query_transactions': {
      let query = supabase
        .from('transactions')
        .select('date, amount, type, category, description, vendor_or_client')
        .eq('business_id', businessId)
        .order('date', { ascending: false })
        .limit((toolInput.limit as number) || 20)

      if (toolInput.date_from) query = query.gte('date', toolInput.date_from as string)
      if (toolInput.date_to) query = query.lte('date', toolInput.date_to as string)
      if (toolInput.type) query = query.eq('type', toolInput.type as string)
      if (toolInput.category) query = query.eq('category', toolInput.category as string)
      if (toolInput.search) query = query.or(
        `description.ilike.%${toolInput.search}%,vendor_or_client.ilike.%${toolInput.search}%`
      )

      const { data, error } = await query
      if (error) return `Error querying transactions: ${error.message}`
      return JSON.stringify(data ?? [], null, 2)
    }

    case 'query_documents': {
      let query = supabase
        .from('documents')
        .select('type, name, expiry_date, is_current, uploaded_at')
        .eq('business_id', businessId)
        .eq('is_current', true)
        .order('uploaded_at', { ascending: false })

      if (toolInput.type) query = query.eq('type', toolInput.type as string)
      if (toolInput.search) query = query.ilike('name', `%${toolInput.search}%`)
      if (toolInput.expiry_status) {
        const today = new Date().toISOString().split('T')[0]
        const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
        if (toolInput.expiry_status === 'expired') {
          query = query.lt('expiry_date', today)
        } else if (toolInput.expiry_status === 'expiring') {
          query = query.gte('expiry_date', today).lte('expiry_date', thirtyDays)
        } else {
          query = query.gt('expiry_date', thirtyDays)
        }
      }

      const { data, error } = await query
      if (error) return `Error querying documents: ${error.message}`
      return JSON.stringify(data ?? [], null, 2)
    }

    case 'query_obligations': {
      let query = supabase
        .from('obligations')
        .select('name, type, frequency, next_due_date, last_completed_at, notes')
        .eq('business_id', businessId)
        .order('next_due_date', { ascending: true })

      if (toolInput.type) query = query.eq('type', toolInput.type as string)
      if (toolInput.frequency) query = query.eq('frequency', toolInput.frequency as string)
      if (toolInput.due_within_days) {
        const futureDate = new Date(
          Date.now() + (toolInput.due_within_days as number) * 86400000
        ).toISOString().split('T')[0]
        query = query.lte('next_due_date', futureDate)
      }

      const { data, error } = await query
      if (error) return `Error querying obligations: ${error.message}`
      return JSON.stringify(data ?? [], null, 2)
    }

    case 'query_team': {
      let query = supabase
        .from('team_members')
        .select('name, nationality, role, start_date, salary, status')
        .eq('business_id', businessId)

      if (toolInput.status) query = query.eq('status', toolInput.status as string)
      if (toolInput.nationality) query = query.ilike('nationality', `%${toolInput.nationality}%`)
      if (toolInput.role) query = query.ilike('role', `%${toolInput.role}%`)

      const { data, error } = await query
      if (error) return `Error querying team: ${error.message}`
      return JSON.stringify(data ?? [], null, 2)
    }

    // ── Action tools ─────────────────────────────────────────────────
    case 'add_transaction': {
      const result = await addTransaction(supabase, businessId, {
        date: toolInput.date as string,
        amount: toolInput.amount as number,
        type: toolInput.type as 'INCOME' | 'EXPENSE',
        category: toolInput.category as string,
        description: toolInput.description as string,
        vendor_or_client: toolInput.vendor_or_client as string | undefined,
      })
      return JSON.stringify(result)
    }

    case 'add_team_member': {
      const result = await addTeamMember(supabase, businessId, {
        name: toolInput.name as string,
        nationality: toolInput.nationality as string,
        role: toolInput.role as string | undefined,
        salary: toolInput.salary as number | undefined,
        start_date: toolInput.start_date as string | undefined,
        iqama_number: toolInput.iqama_number as string | undefined,
      })
      return JSON.stringify(result)
    }

    case 'update_team_member': {
      const result = await updateTeamMember(
        supabase,
        businessId,
        toolInput.member_id as string,
        {
          salary: toolInput.salary as number | undefined,
          role: toolInput.role as string | undefined,
          status: toolInput.status as 'ACTIVE' | 'TERMINATED' | undefined,
        }
      )
      return JSON.stringify(result)
    }

    case 'mark_obligation_done': {
      const result = await markObligationDone(supabase, businessId, toolInput.obligation_id as string)
      return JSON.stringify(result)
    }

    case 'add_obligation': {
      const result = await addObligation(supabase, businessId, {
        name: toolInput.name as string,
        type: toolInput.type as string,
        frequency: toolInput.frequency as string,
        next_due_date: toolInput.next_due_date as string,
        description: toolInput.description as string | undefined,
      })
      return JSON.stringify(result)
    }

    case 'get_document_summary': {
      const result = await getDocumentSummary(supabase, businessId)
      return JSON.stringify(result)
    }

    case 'import_spreadsheet_data': {
      const result = await importExcelData(
        supabase,
        businessId,
        toolInput.dataType as 'transactions' | 'team_members' | 'obligations',
        toolInput.rows as Record<string, unknown>[],
        toolInput.columnMapping as Record<string, string>
      )
      return JSON.stringify(result)
    }

    default:
      return `Unknown tool: ${toolName}`
  }
}

function buildSystemPrompt(businessContext: string, mode: 'chat' | 'advisory' = 'chat'): string {
  if (mode === 'advisory') {
    return `You are Mugdm Business Advisor, an AI-powered strategic advisor for Saudi micro-enterprises. You provide actionable business intelligence and recommendations based on real data.

You have access to the following business context:

${businessContext}

Your advisory focus areas:
1. **Cost Optimization**: Identify unnecessary expenses, suggest ways to reduce overhead, flag duplicate payments or overcharges, and recommend more cost-effective alternatives for recurring expenses.
2. **Saudization Planning**: Analyze the current Saudization ratio, recommend hiring strategies to meet or exceed Nitaqat requirements for the business's industry tier, estimate GOSI cost impact of new hires, and flag compliance risks.
3. **Cash Flow Warnings**: Detect negative cash flow trends, project upcoming cash crunches based on recurring obligations and expense patterns, suggest timing adjustments for large payments, and recommend maintaining adequate cash reserves.
4. **Compliance Risk Assessment**: Identify overdue or soon-to-expire documents and obligations, estimate penalty exposure for non-compliance, prioritize regulatory actions by urgency and financial impact, and recommend a compliance action plan.

Guidelines:
- Be proactive and specific. Don't just describe — recommend concrete actions with estimated impact.
- Answer in the same language the user writes in (Arabic or English).
- For financial analysis, always show amounts in SAR. Quantify savings and risks where possible.
- Prioritize advice by impact: high-impact, low-effort actions first.
- If data is insufficient for analysis, state what's needed and why.
- Never make up data. Base all recommendations on actual business data.
- Structure your responses with clear headers and action items.
- When relevant, mention Saudi regulatory context (Nitaqat bands, VAT thresholds, GOSI rates).`
  }

  return `You are Mugdm AI Assistant, a helpful business management assistant for Saudi micro-enterprises. You help users understand their business data, documents, compliance obligations, finances, and team information.

You have access to the following business context:

${businessContext}

Guidelines:
- Be concise and helpful. Answer in the same language the user writes in (Arabic or English).
- When users ask about specific data, use the provided tools to query accurate information rather than relying solely on the context summary.
- For financial questions, always show amounts in SAR (Saudi Riyal).
- For dates, use clear formats. If the user writes in Arabic, use Hijri dates when relevant.
- If you don't have enough data to answer, say so clearly and suggest what the user might need to add.
- Never make up data. If a query returns empty results, tell the user.
- Keep responses focused on business management topics.
- You can also MODIFY data using action tools (add transactions, add team members, mark obligations done, etc.). Before performing any action, confirm the details with the user. After performing an action, relay the confirmation message to the user.

When the user uploads a spreadsheet, you will receive the parsed data. Analyze it and:
1. Summarize what the spreadsheet contains (number of rows, columns, and what the data appears to represent).
2. Identify if the data maps to Mugdm's data model (transactions, team members, documents, obligations).
3. Suggest importing the data — for example: "I found 145 transactions — want me to import them into your bookkeeper?"
4. If you identify patterns (monthly rent, recurring salaries), suggest setting up automatic tracking.`
}

export async function POST(request: Request) {
  let userId: string | undefined

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    userId = user.id

    const body = (await request.json()) as ChatRequest

    if (!body.businessId) {
      return new Response(JSON.stringify({ error: 'businessId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Rate limit check
    const rateLimitResponse = await enforceRateLimit(body.businessId)
    if (rateLimitResponse) return rateLimitResponse

    // Verify user owns this business
    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', body.businessId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!business) {
      return new Response(JSON.stringify({ error: 'Business not found or access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Handle action confirmation flow
    if (body.confirmAction) {
      return handleActionConfirmation(body, supabase)
    }

    if (!body.message?.trim()) {
      return new Response(JSON.stringify({ error: 'message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get or create conversation
    let conversationId = body.conversationId

    if (conversationId) {
      // Verify conversation belongs to user
      const { data: conv } = await (supabase
        .from('chat_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle() as unknown as Promise<{ data: { id: string } | null }>)

      if (!conv) {
        return new Response(JSON.stringify({ error: 'Conversation not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } else {
      // Create new conversation
      const title = body.message.slice(0, 100) + (body.message.length > 100 ? '...' : '')
      const { data: newConv, error: convError } = await (supabase
        .from('chat_conversations')
        .insert({
          business_id: body.businessId,
          user_id: user.id,
          title,
        } as never)
        .select('id')
        .single() as unknown as Promise<{ data: { id: string } | null; error: { message: string } | null }>)

      if (convError || !newConv) {
        console.error('[API] chat: failed to create conversation:', convError?.message)
        return new Response(JSON.stringify({ error: 'Failed to create conversation' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      conversationId = newConv.id
    }

    // Save user message
    await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      role: 'user' as const,
      content: body.message,
      metadata: {},
    } as never)

    // Load conversation history (last 20 messages for context)
    const { data: history } = await (supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId as string)
      .order('created_at', { ascending: true })
      .limit(20) as unknown as Promise<{ data: { role: string; content: string }[] | null }>)

    // Build context
    const mode = body.mode === 'advisory' ? 'advisory' : 'chat'
    const businessContext = await buildBusinessContext(body.businessId, supabase)
    const systemPrompt = buildSystemPrompt(businessContext, mode)

    // Build messages array from history
    const messages: Anthropic.MessageParam[] = (history ?? []).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

    // Call Claude with streaming
    const anthropic = new Anthropic()
    const chatModel = selectModel({ userId: user.id, task: 'chat' })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = ''

          // Initial Claude call
          const response = await anthropic.messages.create({
            model: chatModel,
            max_tokens: 4096,
            system: systemPrompt,
            messages,
            tools: TOOL_DEFINITIONS,
            stream: true,
          })

          // Process the stream, handling tool use
          let toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
          let currentToolId = ''
          let currentToolName = ''
          let currentToolInput = ''

          for await (const event of response) {
            if (event.type === 'content_block_start') {
              if (event.content_block.type === 'text') {
                // Text block starting
              } else if (event.content_block.type === 'tool_use') {
                currentToolId = event.content_block.id
                currentToolName = event.content_block.name
                currentToolInput = ''
              }
            } else if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                fullResponse += event.delta.text
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`)
                )
              } else if (event.delta.type === 'input_json_delta') {
                currentToolInput += event.delta.partial_json
              }
            } else if (event.type === 'content_block_stop') {
              if (currentToolName) {
                let parsedInput: Record<string, unknown> = {}
                try {
                  parsedInput = currentToolInput ? JSON.parse(currentToolInput) : {}
                } catch {
                  // Empty input is fine
                }
                toolUseBlocks.push({
                  id: currentToolId,
                  name: currentToolName,
                  input: parsedInput,
                })
                currentToolName = ''
                currentToolInput = ''
                currentToolId = ''
              }
            } else if (event.type === 'message_stop') {
              // Message complete
            }
          }

          // Handle tool use if needed (single round)
          if (toolUseBlocks.length > 0) {
            // Separate action tools (need confirmation) from query tools (execute immediately)
            const actionTools = toolUseBlocks.filter((t) => ACTION_TOOLS.has(t.name))
            const queryTools = toolUseBlocks.filter((t) => !ACTION_TOOLS.has(t.name))

            // Execute query tools immediately
            const queryResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
              queryTools.map(async (tool) => {
                const result = await executeToolCall(
                  tool.name,
                  tool.input,
                  body.businessId,
                  supabase
                )
                return {
                  type: 'tool_result' as const,
                  tool_use_id: tool.id,
                  content: result,
                }
              })
            )

            // For action tools, send confirmation request instead of executing
            if (actionTools.length > 0) {
              const actionTool = actionTools[0] // Handle one action at a time
              const summary = formatActionSummary(actionTool.name, actionTool.input)
              const isDestructive = DESTRUCTIVE_TOOLS.has(actionTool.name)

              // Send the confirmation event to the client
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'confirm_action',
                    toolName: actionTool.name,
                    toolInput: actionTool.input,
                    summary,
                    isDestructive,
                  })}\n\n`
                )
              )

              // Save a placeholder assistant message about the pending action
              if (fullResponse) {
                await supabase.from('chat_messages').insert({
                  conversation_id: conversationId!,
                  role: 'assistant' as const,
                  content: fullResponse + '\n\n' + summary,
                  metadata: {},
                } as never)
              }

              // If there were also query results, handle them in a follow-up
              if (queryResults.length > 0) {
                const assistantContent: Anthropic.ContentBlockParam[] = []
                if (fullResponse) {
                  assistantContent.push({ type: 'text', text: fullResponse })
                }
                for (const tool of queryTools) {
                  assistantContent.push({
                    type: 'tool_use',
                    id: tool.id,
                    name: tool.name,
                    input: tool.input,
                  })
                }

                const followUp = await anthropic.messages.create({
                  model: chatModel,
                  max_tokens: 4096,
                  system: systemPrompt,
                  messages: [
                    ...messages,
                    { role: 'assistant', content: assistantContent },
                    { role: 'user', content: queryResults },
                  ],
                  stream: true,
                })

                for await (const event of followUp) {
                  if (
                    event.type === 'content_block_delta' &&
                    event.delta.type === 'text_delta'
                  ) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`
                      )
                    )
                  }
                }
              }

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'done', conversationId })}\n\n`
                )
              )
              controller.close()
              return
            }

            // No action tools, just query tools -- handle normally
            const toolResults = queryResults

            // Build assistant message content for the follow-up
            const assistantContent: Anthropic.ContentBlockParam[] = []
            if (fullResponse) {
              assistantContent.push({ type: 'text', text: fullResponse })
            }
            for (const tool of toolUseBlocks) {
              assistantContent.push({
                type: 'tool_use',
                id: tool.id,
                name: tool.name,
                input: tool.input,
              })
            }

            // Follow-up call with tool results
            fullResponse = '' // Reset for the final response
            const followUp = await anthropic.messages.create({
              model: chatModel,
              max_tokens: 4096,
              system: systemPrompt,
              messages: [
                ...messages,
                { role: 'assistant', content: assistantContent },
                { role: 'user', content: toolResults },
              ],
              stream: true,
            })

            for await (const event of followUp) {
              if (
                event.type === 'content_block_delta' &&
                event.delta.type === 'text_delta'
              ) {
                fullResponse += event.delta.text
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`
                  )
                )
              }
            }

            toolUseBlocks = []
          }

          // Save assistant response
          if (fullResponse) {
            await supabase.from('chat_messages').insert({
              conversation_id: conversationId!,
              role: 'assistant' as const,
              content: fullResponse,
              metadata: {},
            } as never)
          }

          // Send conversation ID and done signal
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'done', conversationId })}\n\n`
            )
          )
          controller.close()
        } catch (err) {
          console.error('[API] chat stream error:', err)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`
            )
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[API] chat failed:', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return new Response(JSON.stringify({ error: 'Chat request failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * Handle a confirmed or cancelled action from the chat UI.
 * When a user clicks "Confirm" or "Cancel" on a pending action,
 * this processes the result.
 */
async function handleActionConfirmation(
  body: ChatRequest,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { confirmAction, businessId, conversationId } = body

  if (!confirmAction) {
    return new Response(JSON.stringify({ error: 'Missing confirmAction' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!confirmAction.confirmed) {
          // User cancelled
          const cancelText = 'Action cancelled.'
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'text', text: cancelText })}\n\n`
            )
          )

          if (conversationId) {
            await supabase.from('chat_messages').insert({
              conversation_id: conversationId,
              role: 'assistant' as const,
              content: cancelText,
              metadata: {},
            } as never)
          }
        } else {
          // User confirmed -- execute the action
          const result = await executeToolCall(
            confirmAction.toolName,
            confirmAction.toolInput,
            businessId,
            supabase
          )

          let parsed: { success?: boolean; message?: string }
          try {
            parsed = JSON.parse(result)
          } catch {
            parsed = { message: result }
          }

          const responseText = parsed.success
            ? parsed.message ?? 'Action completed successfully.'
            : parsed.message ?? 'Action failed.'

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'text', text: responseText })}\n\n`
            )
          )

          if (conversationId) {
            await supabase.from('chat_messages').insert({
              conversation_id: conversationId,
              role: 'assistant' as const,
              content: responseText,
              metadata: {},
            } as never)
          }
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'done', conversationId })}\n\n`
          )
        )
        controller.close()
      } catch (err) {
        console.error('[API] chat action confirmation error:', err)
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', error: 'Action execution failed' })}\n\n`
          )
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
