import Anthropic from '@anthropic-ai/sdk'

import { createClient } from '@/lib/supabase/server'
import { buildBusinessContext } from '@/lib/chat/context-builder'

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

export interface Insight {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  action_url: string
}

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: business } = (await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .single()) as unknown as { data: { id: string } | null }

    if (!business) {
      return Response.json({ error: 'No business found' }, { status: 404 })
    }

    const context = await buildBusinessContext(business.id, supabase)

    const anthropic = new Anthropic()
    const today = new Date().toISOString().split('T')[0]

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: `You are a Saudi business advisor for Mugdm, a platform for micro-enterprises. Today is ${today}. Based on the business context below, provide 3-5 actionable insights. Each insight must be a JSON object with: title (short, actionable), description (1-2 sentences), priority ("high", "medium", or "low"), action_url (one of: "/calendar", "/vault", "/bookkeeper", "/team", "/profile"). Return ONLY a JSON array, no markdown, no explanation.\n\nBusiness context:\n${context}`,
      messages: [
        {
          role: 'user',
          content: 'Generate business insights and weekly action items based on the business data.',
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return Response.json({ insights: [] })
    }

    let insights: Insight[] = []
    try {
      const raw = textBlock.text.trim()
      // Handle potential markdown code fences
      const jsonStr = raw.startsWith('[') ? raw : raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      insights = JSON.parse(jsonStr)
    } catch {
      insights = []
    }

    return Response.json({ insights })
  } catch (error) {
    console.error('Insights API error:', error)
    return Response.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}
