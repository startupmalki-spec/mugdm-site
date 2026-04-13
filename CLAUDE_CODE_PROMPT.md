# Claude Code Implementation Prompt

Copy and paste the prompt below into your Claude Code session.

---

## The Prompt

```
I need you to implement Phase 1 of two PRDs in this Next.js 16 + Supabase codebase. Read both PRDs fully before writing any code:

1. `PRD_AI_OPTIMIZATION.md` — Multi-model routing & cost reduction
2. `PRD_ML_INTELLIGENCE.md` — ML intelligence layer (event collection, user profiles, issue detection, nudges)

The AI optimization PRD must be implemented FIRST because the ML layer depends on Haiku routing for its classification tasks.

## Implementation Order

### Step 1: Multi-Model Router (PRD_AI_OPTIMIZATION)

Update `src/lib/ai/model-router.ts` to implement the task-based model selection:
- Haiku for: receipt OCR, CSV parsing, simple chat queries, transaction categorization, intelligence classification
- Sonnet for: advisory chat, PDF analysis, CR agent, complex document extraction
- Add confidence-based escalation: if Haiku returns low confidence (<0.7), retry with Sonnet
- Keep the existing `selectModel()` function signature but make it actually route based on task type instead of always returning Sonnet

Update `src/lib/ai/usage-tracker.ts`:
- Add a `purpose` field to track intelligence vs user-facing calls separately
- Intelligence classification calls (frustration detection, unmet needs extraction) should NOT count toward user daily rate limits

### Step 2: Response Caching (PRD_AI_OPTIMIZATION)

Create migration `supabase/migrations/002_ai_response_cache.sql`:
- `ai_response_cache` table with: hash of (prompt+model), response, created_at, expires_at, hit_count
- Cache identical document re-analysis and repeated chat queries
- 24-hour TTL default, configurable per task type

Implement cache check in the relevant API routes (document analysis, chat).

### Step 3: Chat Token Reduction (PRD_AI_OPTIMIZATION)

In `src/lib/chat/context-builder.ts`:
- Implement `buildCompactContext()` as the default (it exists but isn't used everywhere)
- Add sliding window for conversation history (last 10 messages, not unlimited)
- Eliminate the double API call pattern in `src/app/api/chat/route.ts` — after tool use, include the tool result in the same completion instead of making a second call

### Step 4: Event Collection Infrastructure (PRD_ML_INTELLIGENCE)

Create migration `supabase/migrations/003_intelligence_layer.sql` with ALL tables from the ML PRD:
- `user_events` (Section 4.1)
- `user_profiles` (Section 5.1)
- `feature_adoption` (Section 7.2)
- `value_realization` (Section 7.3)
- `detected_issues` (Section 6.2)
- `issue_aggregates` (Section 6.3)
- `unmet_needs` (Section 7.4)
- `nudge_rules` (Section 8.1)
- `nudge_log` (Section 8.1)
- `in_app_notifications` (Section 8.4)
Include all indexes, constraints, and CHECK constraints exactly as specified in the PRD.

Create `src/lib/analytics/event-collector.ts` — the client-side dual-write collector (Section 9.1). It must:
- Send events to both PostHog (existing) and our `/api/events` endpoint
- Include session_id, page_path, locale, device_type
- Be fire-and-forget (never block UI)
- Silent fail on errors

Create `src/app/api/events/route.ts` — server-side event collector (Section 9.2).

Create `src/lib/analytics/server-events.ts` — the `emitServerEvent()` helper for API routes (Section 9.3).

### Step 5: Instrument Existing Routes

Add `emitServerEvent()` calls to these existing files (minimal changes — just add the event emission, don't refactor):
- `src/app/api/chat/route.ts` — emit `chat.message_sent`, `chat.tool_used`, `chat.tool_rejected`, `chat.response_received`
- Bookkeeper upload routes — emit `bookkeeper.upload_start`, `bookkeeper.upload_complete`, `bookkeeper.upload_fail`
- `src/app/api/notifications/send/route.ts` — emit `notification.email_sent`, `compliance.obligation_overdue`
- Transaction update routes — emit `bookkeeper.tx_edit`, `bookkeeper.tx_review`

Add client-side `track()` calls to:
- `src/components/ui/getting-started-checklist.tsx` — emit `onboarding.step_complete` events AND persist to server (currently localStorage only)
- `src/components/ui/tour-overlay.tsx` — emit `onboarding.tour_step_view`, `onboarding.tour_dismiss`
- Add `trackPageView()` to the root layout or navigation component

### Step 6: User Profiles & Scoring

Create `supabase/functions/compute-profiles/index.ts` (Supabase Edge Function):
- Runs every 6 hours via cron
- For each business: query last 7 days of events, compute engagement/health/churn scores using the heuristic functions from PRD Sections 5.2-5.4
- Update lifecycle stage transitions (Section 5.5)
- Update `feature_adoption` and `value_realization` tables

### Step 7: Frustration Detection

Add async Haiku classification in the chat route:
- After streaming the chat response back to the user, fire a non-blocking Haiku call using the frustration classifier prompt from PRD Section 6.1
- If frustration detected with confidence > 0.7, insert into `detected_issues`
- This must NOT slow down chat responses — run it with a detached promise or Edge Function

Implement behavioral pattern detection (Section 6.1, Signal 2):
- Error spiral: >3 errors in one session
- Rate limit frustration: hit rate limit → left within 2 minutes
- These are computed during the profile recomputation cron

### Step 8: Nudge System

Create `supabase/functions/evaluate-nudges/index.ts`:
- Runs every 6 hours (after profile computation)
- Evaluates all active nudge rules against user profiles
- Respects cooldown (72 hours between nudges to same user)
- Max 1 nudge per cycle per user
- For in-app: inserts into `in_app_notifications`
- For email: calls existing Resend system with new nudge templates

Create bilingual nudge email templates in `src/lib/email/templates.ts` — follow the existing pattern (baseLayout, locale-aware, dark theme).

Create `src/app/api/notifications/in-app/route.ts` — GET (fetch unread) and PATCH (mark read/dismissed).

Seed the 7 Phase 1 nudge rules from PRD Section 8.2 into `nudge_rules` via the migration.

### Step 9: Admin Dashboard

Create a basic internal page at `src/app/[locale]/(app)/admin/intelligence/page.tsx`:
- User health table: all users sorted by churn_risk_score DESC
- Issue feed: recent detected issues, filterable by type/severity
- Feature adoption grid: 8 features × adoption percentage
- This can be a simple server component with HTML tables — no fancy UI needed
- Gate access: only allow if user email matches an admin allowlist

## Key Constraints

- All Supabase tables need RLS policies following the existing pattern in `001_initial_schema.sql`
- The admin endpoints need service_role access, not user-scoped
- Event collection must NEVER break the app — all analytics code silent-fails
- Haiku classification calls use the model router's 'efficient' tier
- Run `npx tsc --noEmit` after implementation to check for type errors
- Run the existing tests with `npx vitest run` to make sure nothing is broken
```

---

**Usage:** Copy everything between the triple backticks above and paste it as your first message in a new Claude Code session opened in the `mugdm-site` directory.
