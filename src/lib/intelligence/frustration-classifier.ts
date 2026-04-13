import Anthropic from '@anthropic-ai/sdk'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'
import { selectModel } from '@/lib/ai/model-router'
import { trackUsage } from '@/lib/ai/usage-tracker'
import { createClient as createServerClient } from '@/lib/supabase/server'

/**
 * Frustration classifier (PRD_ML §6.1).
 * Called async after the chat response streams back — never blocks the user.
 * Uses Haiku via the intelligence_classification tier (free of user rate limits).
 * Any error is swallowed; analytics must never break the app.
 */

const PROMPT = `You are a frustration detector for a Saudi business management platform.
Analyze this user message and respond with JSON only.

Signals to look for:
- Explicit complaints: "this doesn't work", "مايشتغل", "broken"
- Repeated questions (same topic asked differently)
- Confusion: "I don't understand", "مافهمت", "how do I..."
- Giving up language: "never mind", "forget it", "خلاص"
- Escalation requests: "let me talk to someone", "support"
- Arabic frustration markers: "والله", "يخي", "ليش"

Respond ONLY with JSON, no prose:
{"frustrated": boolean, "confidence": 0.0-1.0, "signal_type": "complaint"|"confusion"|"giving_up"|"escalation"|"none", "topic": "brief topic", "severity": "low"|"medium"|"high"}`

export interface FrustrationResult {
  frustrated: boolean
  confidence: number
  signal_type: 'complaint' | 'confusion' | 'giving_up' | 'escalation' | 'none'
  topic?: string
  severity?: 'low' | 'medium' | 'high'
}

const DETECTION_THRESHOLD = 0.7

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function classifyFrustration(message: string): Promise<FrustrationResult | null> {
  try {
    const anthropic = new Anthropic()
    const model = selectModel({
      userId: 'system',
      task: 'intelligence_classification',
      purpose: 'intelligence_classification',
    })

    const response = await anthropic.messages.create({
      model,
      max_tokens: 256,
      system: PROMPT,
      messages: [{ role: 'user', content: message.slice(0, 2000) }],
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}')
    if (jsonStart === -1 || jsonEnd === -1) return null

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as FrustrationResult
    if (typeof parsed.frustrated !== 'boolean' || typeof parsed.confidence !== 'number') {
      return null
    }

    // Track intelligence call — doesn't count against user rate limits.
    const supabase = await createServerClient().catch(() => null)
    if (supabase) {
      trackUsage(
        supabase,
        'system',
        model,
        response.usage.input_tokens,
        response.usage.output_tokens,
        {
          taskType: 'intelligence_classification',
          purpose: 'intelligence_classification',
          confidence: parsed.confidence,
        }
      ).catch(() => {})
    }

    return parsed
  } catch {
    return null
  }
}

/**
 * Fire-and-forget: classify the message, and if frustration is detected with
 * high confidence, insert a row in detected_issues. Safe to call from the
 * chat route — all errors silent.
 */
export function classifyAndRecordFrustration(args: {
  businessId: string
  userMessage: string
  conversationId?: string | null
}): void {
  void (async () => {
    const result = await classifyFrustration(args.userMessage)
    if (!result || !result.frustrated) return
    if (result.confidence < DETECTION_THRESHOLD) return

    const client = serviceClient()
    if (!client) return

    try {
      const issueType: 'ux_confusion' | 'bug' =
        result.signal_type === 'confusion' ? 'ux_confusion' : 'bug'

      await client.from('detected_issues').insert({
        business_id: args.businessId,
        issue_type: issueType,
        severity: (result.severity ?? 'low') as string,
        status: 'open',
        source: 'chat_nlp',
        title: `Frustration detected: ${result.signal_type}`,
        description: result.topic ?? null,
        evidence: [
          {
            conversation_id: args.conversationId ?? null,
            message_preview: args.userMessage.slice(0, 200),
            confidence: result.confidence,
            signal_type: result.signal_type,
          },
        ] as never,
      } as never)
    } catch {
      // Silent
    }
  })()
}
