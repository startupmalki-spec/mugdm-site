# PRD: AI Tool Optimization — Multi-Model Routing & Cost Reduction

> **Author:** Moe (mmalki@tamcapital.sa)
> **Date:** 2026-04-13
> **Status:** Draft
> **Priority:** P0

---

## 1. Problem Statement

Yesterday during live testing, users hit the daily AI rate limit (50 calls for free tier) within a normal usage session. The root cause is that **every AI-powered feature makes a full API call to Claude Sonnet**, regardless of task complexity. A simple receipt scan costs the same as a multi-turn advisory chat session.

### What's happening today

| Feature | Model Used | Avg Tokens In | Avg Tokens Out | Est. Cost/Call | Calls/Session |
|---------|-----------|---------------|----------------|----------------|---------------|
| Document analysis | Sonnet | ~4,000 | ~800 | $0.024 | 2-5 |
| Receipt OCR | Sonnet | ~3,500 | ~500 | $0.018 | 5-15 |
| Chat (query tools) | Sonnet | ~6,000 | ~1,200 | $0.036 | 10-30+ |
| Chat (follow-up after tool use) | Sonnet (again) | ~6,000 | ~1,000 | $0.033 | 5-15 |
| Bank statement parsing | Sonnet | ~8,000 | ~2,000 | $0.054 | 1-3 |
| **Total per active session** | | | | **~$0.50-$1.50** | **25-70** |

A single active user can burn through the free tier (50 calls) in one bookkeeping session: upload 10 receipts (10 calls) + parse a bank statement (1-2 calls) + chat about the results (15-30 calls) + upload 3 documents (3-5 calls) = **30-47 calls**.

### The real pain

- Users doing real work (not just testing) will consistently hit rate limits
- Every call uses Sonnet ($3/$15 per M tokens) even when Haiku ($0.80/$4) would produce identical results
- The chat assistant makes 2 API calls per tool-use interaction (initial + follow-up), doubling cost
- No caching — re-analyzing the same document costs the same every time
- No batching — 10 receipts = 10 separate API calls

---

## 2. Goals & Success Metrics

### Goals

1. **Reduce cost per user session by 60-70%** through intelligent model routing
2. **Increase effective rate limit by 3-5x** without increasing API spend
3. **Maintain quality** — users should not notice degraded output for any feature
4. **Add observability** — know which features cost how much and where to optimize next

### Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Avg API calls per session | 25-70 | 15-30 | `ai_usage_log` table |
| Avg cost per session (USD) | $0.50-$1.50 | $0.15-$0.45 | Usage tracker |
| Rate limit hits per day | 5-10 users | <1 user | 429 response count |
| User-perceived quality | Baseline | No regression | Spot-check + feedback |
| P95 response latency | ~3s | ≤2s (Haiku tasks) | Server logs |

---

## 3. Solution: Multi-Model Routing Strategy

### 3.1 Model Tier Assignment

The key insight: **not all AI tasks need the same intelligence level**. Here's how to route:

| Task | Current Model | Proposed Model | Why | Est. Savings |
|------|--------------|----------------|-----|-------------|
| **Receipt OCR** | Sonnet ($0.018) | **Haiku** ($0.004) | Structured extraction from a clear image — Haiku excels at this | **78%** |
| **Transaction categorization** | Sonnet (via chat) | **Haiku** ($0.002) | Pattern matching against known Saudi vendors — trivial for any model | **89%** |
| **Bank statement parsing (CSV)** | Sonnet ($0.054) | **Haiku** ($0.012) | CSV→JSON transformation is mechanical; Saudi bank formats are consistent | **78%** |
| **Bank statement parsing (PDF)** | Sonnet ($0.054) | **Sonnet** ($0.054) | PDFs with messy layouts need stronger reasoning — keep on Sonnet | **0%** |
| **Document analysis (standard)** | Sonnet ($0.024) | **Haiku** ($0.005) | Most Saudi gov docs have standard layouts (CR, GOSI cert) | **79%** |
| **Document analysis (complex/multi-page)** | Sonnet ($0.024) | **Sonnet** ($0.024) | Multi-page contracts, leases with variable layouts | **0%** |
| **CR extraction (with agent)** | Sonnet | **Sonnet** | Multi-step agent with QR verification — needs strong reasoning | **0%** |
| **Chat (simple queries)** | Sonnet ($0.036) | **Haiku** ($0.008) | "What's my revenue this month?" → tool call → format answer | **78%** |
| **Chat (advisory mode)** | Sonnet ($0.036) | **Sonnet** ($0.036) | Strategic advice needs strong analytical capability | **0%** |
| **Chat (first message in session)** | Sonnet | **Sonnet** | First impression matters; needs best quality | **0%** |

### 3.2 Updated Model Router

Replace the current `selectModel()` with a smarter router:

```typescript
// src/lib/ai/model-router.ts

const MODEL_TIERS = {
  premium: 'claude-opus-4-0520',
  standard: 'claude-sonnet-4-20250514',
  efficient: 'claude-haiku-4-5-20251001',
} as const

type TaskType =
  | 'onboarding'
  | 'document_analysis'
  | 'document_analysis_complex'
  | 'receipt_analysis'
  | 'chat'
  | 'chat_advisory'
  | 'chat_first_message'
  | 'classification'
  | 'categorization'
  | 'insights'
  | 'statement_parsing_csv'
  | 'statement_parsing_pdf'
  | 'cr_extraction'

// Tasks that can safely use the cheapest model
const HAIKU_TASKS = new Set<TaskType>([
  'receipt_analysis',
  'classification',
  'categorization',
  'statement_parsing_csv',
  'document_analysis',     // standard single-page docs
  'chat',                  // simple query-and-respond
])

// Tasks that need Sonnet-level reasoning
const SONNET_TASKS = new Set<TaskType>([
  'onboarding',
  'document_analysis_complex',
  'statement_parsing_pdf',
  'chat_advisory',
  'chat_first_message',
  'cr_extraction',
  'insights',
])

export function selectModel(options: RouteOptions): string {
  // First-time users always get premium for onboarding
  if (options.isFirstUse) return MODEL_TIERS.premium

  // Haiku for lightweight tasks
  if (HAIKU_TASKS.has(options.task)) return MODEL_TIERS.efficient

  // Sonnet for complex reasoning
  if (SONNET_TASKS.has(options.task)) return MODEL_TIERS.standard

  // Default to efficient
  return MODEL_TIERS.efficient
}
```

### 3.3 Projected Cost Impact

| Scenario | Calls | Old Cost | New Cost | Savings |
|----------|-------|----------|----------|---------|
| Upload 10 receipts | 10 | $0.18 | $0.04 | **78%** |
| Parse CSV statement | 1 | $0.054 | $0.012 | **78%** |
| Chat session (15 msgs, 5 tool calls) | 20 | $0.72 | $0.22 | **69%** |
| Upload 3 documents | 3 | $0.072 | $0.015 | **79%** |
| Advisory chat (5 msgs) | 7 | $0.25 | $0.25 | **0%** |
| **Total session** | **41** | **$1.28** | **$0.54** | **58%** |

---

## 4. Additional Optimizations

### 4.1 Response Caching (Phase 2)

Cache AI responses for identical inputs. High-value targets:

| Cacheable | Cache Key | TTL | Impact |
|-----------|-----------|-----|--------|
| Document re-analysis | `sha256(file_content)` | 30 days | Eliminates re-scans of same doc |
| Receipt re-analysis | `sha256(base64_data)` | 30 days | Same receipt uploaded twice |
| Chat business context | `business_id + context_hash` | 5 min | Avoid rebuilding context every message |
| Transaction categorization | `vendor_name + description_hash` | 7 days | Same vendor → same category |

**Implementation:** Add a `ai_response_cache` table in Supabase:

```sql
CREATE TABLE ai_response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  task_type TEXT NOT NULL,
  model TEXT NOT NULL,
  response JSONB NOT NULL,
  tokens_saved_in INT DEFAULT 0,
  tokens_saved_out INT DEFAULT 0,
  hit_count INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_cache_key ON ai_response_cache(cache_key);
CREATE INDEX idx_cache_expiry ON ai_response_cache(expires_at);
```

**Estimated impact:** 15-25% fewer API calls from repeat operations.

### 4.2 Batch Receipt Processing (Phase 2)

Instead of 10 separate API calls for 10 receipts, batch them:

- **Current:** 10 receipts → 10 API calls → 10 × $0.018 = $0.18
- **Proposed:** 10 receipts → 1 API call with all images → ~$0.03

Anthropic supports multi-image messages. Send up to 5 receipt images in a single message with instructions to extract data for each one. This cuts calls by 80% for bulk uploads.

```typescript
// Pseudocode for batch receipt processing
async function batchAnalyzeReceipts(receipts: Receipt[]): Promise<ExtractionResult[]> {
  const BATCH_SIZE = 5
  const batches = chunk(receipts, BATCH_SIZE)
  
  const results = await Promise.all(
    batches.map(batch => {
      const content = batch.flatMap(r => [
        { type: 'image', source: { type: 'base64', data: r.base64Data } },
        { type: 'text', text: `Receipt ${r.index}: Extract data for this receipt.` }
      ])
      return anthropic.messages.create({
        model: selectModel({ task: 'receipt_analysis' }),
        messages: [{ role: 'user', content: [...content, BATCH_PROMPT] }],
      })
    })
  )
  
  return results.flatMap(parseMultiReceiptResponse)
}
```

### 4.3 Smart Chat Token Reduction (Phase 1)

The chat route is the biggest cost driver. Key optimizations:

**A. Compress business context:** The `buildBusinessContext()` function currently dumps a full business summary into every chat message. Instead:
- Only include context relevant to the user's query (detect topic → inject only that slice)
- Cache the full context and send a compressed version (~40% token reduction)

**B. Sliding conversation window:** Currently loads last 20 messages. Implement:
- Last 6 messages as full text
- Messages 7-20 as a compressed summary (1 Haiku call to summarize, cached)
- Saves ~50% tokens on long conversations

**C. Eliminate double-call for tool use:** Currently the chat makes 2 API calls when tools are involved (initial call → tool execution → follow-up call). Optimize:
- For simple query tools, use Haiku for the follow-up formatting call
- Pre-format common tool outputs server-side to avoid the follow-up call entirely

### 4.4 Client-Side Categorization (Phase 1)

The `smart-categorizer.ts` already has rule-based categorization. Currently it runs client-side but the chat assistant **also** categorizes via AI. Fix:

- Run `categorizeTransaction()` server-side BEFORE deciding whether to call AI
- If confidence > 0.8, skip the AI call entirely
- Only escalate to AI for ambiguous transactions (confidence < 0.8)

**Estimated impact:** 30-50% fewer classification AI calls.

### 4.5 Rate Limit UX Improvements (Phase 1)

Even with cost optimizations, users need a better experience when approaching limits:

- **Usage meter in UI:** Show "12 of 50 AI actions used today" in the dashboard sidebar
- **Predictive warning:** "You have ~8 AI actions left. Batch your remaining receipts for efficiency."
- **Graceful degradation:** When near limit, switch to Haiku for all tasks (not just Haiku-eligible ones)
- **Explain the limit:** Show a clear message with tier comparison: "Upgrade to Pro for 500 daily AI actions"

---

## 5. Implementation Phases

### Phase 1: Quick Wins (Week 1-2) — Est. 40-50% cost reduction

| Task | Effort | Impact |
|------|--------|--------|
| Update `selectModel()` to route Haiku-eligible tasks | S | High |
| Split `statement_parsing` into `_csv` and `_pdf` task types | S | Medium |
| Split `document_analysis` into standard and complex | S | Medium |
| Split `chat` into `chat`, `chat_advisory`, `chat_first_message` | M | High |
| Add usage meter component to dashboard | M | Medium (UX) |
| Use Haiku for chat follow-up calls (after tool results) | S | High |
| Run `categorizeTransaction()` server-side before AI fallback | S | Medium |

### Phase 2: Caching & Batching (Week 3-4) — Est. additional 15-25% reduction

| Task | Effort | Impact |
|------|--------|--------|
| Create `ai_response_cache` table and migration | M | High |
| Add cache layer to document/receipt analysis routes | M | High |
| Implement batch receipt processing endpoint | L | High |
| Compress business context for chat | M | Medium |
| Implement sliding conversation window | M | Medium |

### Phase 3: Observability & Auto-Tuning (Week 5-6)

| Task | Effort | Impact |
|------|--------|--------|
| Build AI usage analytics dashboard (internal) | L | Visibility |
| Track quality metrics per model per task | M | Quality |
| A/B test Haiku vs Sonnet on borderline tasks | M | Data-driven |
| Auto-escalation: if Haiku returns low confidence, retry with Sonnet | M | Quality |
| Implement cost alerts for high-usage businesses | S | Ops |

---

## 6. Quality Guardrails

Routing to cheaper models must not degrade user experience. Safeguards:

### 6.1 Confidence-Based Escalation

Every AI response includes an `ai_confidence` score. If Haiku returns confidence < 0.6:
1. Automatically retry with Sonnet
2. Log the escalation for analysis
3. If a task escalates >30% of the time, move it back to Sonnet tier

### 6.2 Quality Monitoring

Track these metrics per task per model:

- **Extraction accuracy:** Compare AI-extracted fields against user corrections (when they edit a receipt or document after extraction)
- **Chat satisfaction:** Track if users rephrase/repeat questions (signal of bad response)
- **Categorization accuracy:** Compare AI category vs user's final category choice

### 6.3 User Override

Power users (Pro/Business tier) can opt into "High Quality Mode" in settings, which forces Sonnet for all tasks. This costs them more of their daily quota but guarantees best results.

---

## 7. Pricing Model Adjustments

With cost reductions, we can afford to be more generous with limits:

| Tier | Current Limit | Proposed Limit | Monthly API Cost (est.) |
|------|--------------|----------------|------------------------|
| Free | 50 calls/day | 100 calls/day | ~$3-5/user/month |
| Pro | 500 calls/day | 1,000 calls/day | ~$15-25/user/month |
| Business | Unlimited | Unlimited | ~$30-60/user/month |

The 2x increase in limits costs roughly the same as before because each call is 60-70% cheaper.

---

## 8. Technical Architecture

```
┌─────────────────────────────────────────────────┐
│                   API Route                      │
│  (analyze-document, analyze-receipt, chat, etc.) │
└───────────────┬─────────────────────────────────┘
                │
                ▼
┌───────────────────────────┐
│     Cache Check            │
│  ai_response_cache table   │──▶ HIT → return cached
└───────────────┬───────────┘
                │ MISS
                ▼
┌───────────────────────────┐
│     Model Router           │
│  selectModel(task, context)│
│  ┌─────────┬────────────┐ │
│  │ Haiku   │ Sonnet     │ │
│  │ receipt │ advisory   │ │
│  │ csv     │ pdf parse  │ │
│  │ chat    │ cr agent   │ │
│  │ classify│ complex doc│ │
│  └─────────┴────────────┘ │
└───────────────┬───────────┘
                │
                ▼
┌───────────────────────────┐
│     Anthropic API Call     │
└───────────────┬───────────┘
                │
                ▼
┌───────────────────────────┐
│   Confidence Check         │
│   < 0.6? → escalate       │
│   to Sonnet & retry        │
└───────────────┬───────────┘
                │
                ▼
┌───────────────────────────┐
│   Usage Tracker            │
│   Log model, tokens, cost  │
│   Check remaining quota    │
└───────────────┬───────────┘
                │
                ▼
┌───────────────────────────┐
│   Cache Write              │
│   Store response for       │
│   future identical requests│
└───────────────────────────┘
```

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Haiku quality degrades on Arabic OCR | Medium | High | A/B test with 100 real receipts before shipping; auto-escalate on low confidence |
| Cache serves stale data | Low | Medium | TTL-based expiry + cache-bust on document re-upload |
| Batch processing increases latency | Medium | Low | Process batches async with progress indicator in UI |
| Users notice quality drop in chat | Medium | High | Keep first message on Sonnet; only downgrade subsequent simple queries |
| Anthropic pricing changes | Low | Medium | Abstract model costs in config; update `COST_PER_MILLION_TOKENS` map |

---

## 10. Open Questions

1. **Should we offer a "pay-per-use" option** beyond the daily limit? (e.g., SAR 0.50 per additional 10 AI calls)
2. **Should advisory mode always be Sonnet**, or can we detect simple advisory questions and route to Haiku?
3. **Do we need a separate Haiku quality benchmark for Arabic text** before shipping, or is the confidence-based escalation sufficient?
4. **Should batch processing be opt-in** (user clicks "Batch Upload") or automatic when >3 receipts are queued?

---

## 11. Appendix: Current Codebase References

| File | What It Does |
|------|-------------|
| `src/lib/ai/model-router.ts` | Current model selection (everything → Sonnet) |
| `src/lib/ai/usage-tracker.ts` | Logs AI calls with token counts and cost estimates |
| `src/lib/rate-limit.ts` | Tier-based daily limits (50/500/unlimited) |
| `src/lib/rate-limit-middleware.ts` | Rate limit enforcement + response headers |
| `src/app/api/analyze-document/route.ts` | Document analysis (uses Sonnet) |
| `src/app/api/analyze-receipt/route.ts` | Receipt OCR (uses Sonnet) |
| `src/app/api/chat/route.ts` | Chat with tools (uses Sonnet, 2 calls per tool use) |
| `src/app/api/parse-statement/route.ts` | Bank statement parsing (uses Sonnet) |
| `src/lib/bookkeeper/smart-categorizer.ts` | Rule-based categorization (client-side, not used server-side) |
