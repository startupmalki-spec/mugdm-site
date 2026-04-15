/**
 * Multi-agent orchestrator for the Chat AI.
 *
 * Claude (claude-opus-4-6) acts as a router: it picks one or more sub-agents
 * via tool-use, each sub-agent returns { answer, sources }, then Claude
 * synthesizes a final response with citations.
 *
 * Sub-agents:
 *   - bills_agent:      direct SQL over bills/vendors (read-only, scoped to businessId)
 *   - compliance_agent: obligations table + RAG retrieval over regs
 *   - regs_agent:       RAG retrieval over ZATCA / GOSI / SOCPA corpora
 *
 * Feature-flagged via NEXT_PUBLIC_FEATURE_MULTI_AGENT. Scaffolding only —
 * actual corpus content lands in a later wave.
 */

import Anthropic from '@anthropic-ai/sdk'

import { createClient } from '@/lib/supabase/server'

import {
  listBills,
  sumApOutstanding,
  billsDueThisWeek,
} from '@/lib/agents/bills-chat-tools'
import { retrieve } from '@/lib/rag/retriever'
import type {
  OrchestrateParams,
  OrchestratorResult,
  OrchestratorSource,
  SubAgentResult,
} from '@/lib/rag/types'

const ORCHESTRATOR_MODEL = 'claude-opus-4-6'
const MAX_ROUTING_ITERATIONS = 4

/* ───────── Sub-agent context ───────── */

interface SubAgentContext {
  businessId: string
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
}

type SubAgent = (userQuery: string, ctx: SubAgentContext) => Promise<SubAgentResult>

/* ───────── Shared helpers ───────── */

function formatRagSources(
  chunks: Awaited<ReturnType<typeof retrieve>>['chunks']
): OrchestratorSource[] {
  return chunks.map((c) => ({
    kind: 'rag' as const,
    sourceType: c.source_type,
    title: (c.metadata?.title as string | undefined) ?? undefined,
    excerpt: c.content.slice(0, 240),
    score: c.score,
    ref: c.document_id,
  }))
}

function renderRagContext(
  chunks: Awaited<ReturnType<typeof retrieve>>['chunks']
): string {
  if (chunks.length === 0) return '(no relevant passages retrieved)'
  return chunks
    .map((c, i) => {
      const title = (c.metadata?.title as string | undefined) ?? c.source_type
      return `[${i + 1}] (${c.source_type} — ${title}, score=${c.score.toFixed(3)})\n${c.content}`
    })
    .join('\n\n')
}

/* ───────── Sub-agent: BillsAgent ───────── */
/**
 * Read-only bills data. No vector search — the data is already structured.
 * Pulls a compact snapshot (recent + due soon + outstanding totals) and lets
 * the sub-agent's Claude call reason over it.
 */
const BillsAgent: SubAgent = async (userQuery, ctx) => {
  const supabase = await createClient()

  // Use the same bill-aware tool implementations registered on the chat catalog,
  // so single-agent and multi-agent paths share one code path. RLS scopes by user.
  void ctx.businessId
  const [recent, dueThisWeek, outstanding] = await Promise.all([
    listBills(supabase, { limit: 10 }),
    billsDueThisWeek(supabase),
    sumApOutstanding(supabase),
  ])

  const snapshot = {
    outstanding,
    dueThisWeek,
    recent,
  }

  const anthropic = new Anthropic()
  const resp = await anthropic.messages.create({
    model: ORCHESTRATOR_MODEL,
    max_tokens: 1024,
    system:
      'You are the Bills sub-agent. Answer the question using ONLY the provided bills snapshot (JSON). Be concise and cite bill numbers when relevant. Currency is SAR.',
    messages: [
      {
        role: 'user',
        content: `User question: ${userQuery}\n\nSnapshot:\n${JSON.stringify(snapshot, null, 2)}`,
      },
    ],
  })

  const answer = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  const dueSoonArr = Array.isArray(dueThisWeek) ? dueThisWeek : []
  const sources: OrchestratorSource[] = dueSoonArr.slice(0, 3).map((b) => {
    const bill = b as { id: string; bill_number: string | null }
    return {
      kind: 'db' as const,
      sourceType: 'bill',
      title: bill.bill_number ?? `bill ${bill.id}`,
      ref: bill.id,
    }
  })

  return { answer, sources }
}

/* ───────── Sub-agent: RegsAgent ───────── */
/**
 * RAG-backed regulatory Q&A over ZATCA / GOSI / SOCPA corpora.
 */
const RegsAgent: SubAgent = async (userQuery, ctx) => {
  const { chunks } = await retrieve({
    query: userQuery,
    businessId: ctx.businessId,
    sourceTypes: ['zatca_reg', 'gosi_reg', 'socpa'],
    k: 8,
  })

  const anthropic = new Anthropic()
  const resp = await anthropic.messages.create({
    model: ORCHESTRATOR_MODEL,
    max_tokens: 1024,
    system: `You are the Regulations sub-agent for Saudi Arabian tax/social-insurance/accounting rules.
Answer ONLY from the passages below. If the passages don't cover the question, say so plainly — do not guess.
Cite passage numbers like [1], [2] inline.

Passages:
${renderRagContext(chunks)}`,
    messages: [{ role: 'user', content: userQuery }],
  })

  const answer = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  return { answer, sources: formatRagSources(chunks) }
}

/* ───────── Sub-agent: ComplianceAgent ───────── */
/**
 * Business-specific obligations + RAG over regs for context.
 */
const ComplianceAgent: SubAgent = async (userQuery, ctx) => {
  const supabase = await createClient()

  const [{ data: obligations }, ragResult] = await Promise.all([
    supabase
      .from('obligations')
      .select('id, name, type, frequency, next_due_date, last_completed_at')
      .eq('business_id', ctx.businessId)
      .order('next_due_date', { ascending: true })
      .limit(25),
    retrieve({
      query: userQuery,
      businessId: ctx.businessId,
      sourceTypes: ['zatca_reg', 'gosi_reg', 'socpa'],
      k: 5,
    }),
  ])

  const anthropic = new Anthropic()
  const resp = await anthropic.messages.create({
    model: ORCHESTRATOR_MODEL,
    max_tokens: 1024,
    system: `You are the Compliance sub-agent. Combine:
  (a) the user's live obligations table (JSON below), and
  (b) retrieved regulation passages.
Be precise about dates and filing frequencies. Cite passages [1], [2]… when citing a rule.

Obligations:
${JSON.stringify(obligations ?? [], null, 2)}

Passages:
${renderRagContext(ragResult.chunks)}`,
    messages: [{ role: 'user', content: userQuery }],
  })

  const answer = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  const obligationSources: OrchestratorSource[] = (obligations ?? []).slice(0, 3).map((row) => {
    const o = row as { id: string; name: string }
    return {
      kind: 'db' as const,
      sourceType: 'obligation',
      title: o.name,
      ref: o.id,
    }
  })

  return {
    answer,
    sources: [...obligationSources, ...formatRagSources(ragResult.chunks)],
  }
}

/* ───────── Router tools ───────── */

const ROUTER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'bills_agent',
    description:
      'Answer questions about accounts payable: outstanding bills, vendors, due dates, overdue amounts, totals. Use for any bills/AP/vendor-payment questions.',
    input_schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The user question to answer' },
      },
      required: ['question'],
    },
  },
  {
    name: 'compliance_agent',
    description:
      "Answer questions about the business's own compliance obligations (VAT filing, GOSI payments, Balady, ZATCA e-invoicing onboarding). Use when the question is about THIS business's deadlines or status.",
    input_schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The user question to answer' },
      },
      required: ['question'],
    },
  },
  {
    name: 'regs_agent',
    description:
      'Answer general questions about Saudi tax/social-insurance/accounting regulations (ZATCA rules, GOSI law, SOCPA standards). Use when the question is about what the LAW says, not this business specifically.',
    input_schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The user question to answer' },
      },
      required: ['question'],
    },
  },
]

const SUB_AGENTS: Record<string, SubAgent> = {
  bills_agent: BillsAgent,
  compliance_agent: ComplianceAgent,
  regs_agent: RegsAgent,
}

/* ───────── Orchestrator ───────── */

export class MultiAgentOrchestrator {
  async orchestrate(params: OrchestrateParams): Promise<OrchestratorResult> {
    const { userQuery, businessId, conversationHistory = [] } = params
    const anthropic = new Anthropic()

    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user' as const, content: userQuery },
    ]

    const trace: string[] = []
    const allSources: OrchestratorSource[] = []

    for (let iter = 0; iter < MAX_ROUTING_ITERATIONS; iter++) {
      const resp = await anthropic.messages.create({
        model: ORCHESTRATOR_MODEL,
        max_tokens: 2048,
        system: `You are the Mugdm Chat orchestrator. You route each user question to one or more specialist sub-agents and synthesize their answers.

Routing guidance:
  - bills_agent → AP / vendor / outstanding-payment questions
  - compliance_agent → THIS business's filing deadlines, obligation status
  - regs_agent → general Saudi regulations (ZATCA/GOSI/SOCPA) — "what does the law say"

You MAY call multiple sub-agents if a question spans domains. After you have enough information, respond with the final synthesized answer. Preserve citation markers from sub-agents when relevant.`,
        tools: ROUTER_TOOLS,
        messages,
      })

      if (resp.stop_reason === 'end_turn' || resp.stop_reason === 'stop_sequence') {
        const text = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('')
        return { answer: text, sources: allSources, trace }
      }

      const toolUses = resp.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      )

      if (toolUses.length === 0) {
        // No tool call and not end_turn — return best-effort text.
        const text = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('')
        return { answer: text, sources: allSources, trace }
      }

      messages.push({ role: 'assistant', content: resp.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const use of toolUses) {
        const agent = SUB_AGENTS[use.name]
        if (!agent) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: use.id,
            content: `Unknown sub-agent: ${use.name}`,
            is_error: true,
          })
          continue
        }
        trace.push(use.name)
        const input = use.input as { question?: string }
        try {
          const result = await agent(input.question ?? userQuery, {
            businessId,
            conversationHistory,
          })
          allSources.push(...result.sources)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: use.id,
            content: result.answer,
          })
        } catch (err) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: use.id,
            content: `Sub-agent error: ${err instanceof Error ? err.message : String(err)}`,
            is_error: true,
          })
        }
      }

      messages.push({ role: 'user', content: toolResults })
    }

    return {
      answer:
        'I reached the orchestration step limit without producing a final answer. Please rephrase or narrow your question.',
      sources: allSources,
      trace,
    }
  }
}

export const orchestrator = new MultiAgentOrchestrator()
