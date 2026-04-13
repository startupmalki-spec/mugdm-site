# PRD: ML Intelligence Layer — User Behavior, Issue Detection & Product Analytics

> **Author:** Moe (mmalki@tamcapital.sa)
> **Date:** 2026-04-13
> **Status:** Draft
> **Priority:** P1
> **Depends on:** PRD_AI_OPTIMIZATION.md (multi-model routing for Haiku classification)

---

## 1. Problem Statement

Mugdm currently operates blind. We have no systematic understanding of how users interact with the platform, where they get stuck, what frustrates them, or what they actually need. The data we do collect (PostHog page views, AI usage logs) sits in silos with no intelligence layer connecting the dots.

### What we're missing today

**Per-user intelligence:** We can't answer "Is this user about to churn?" or "Has this user discovered the bookkeeper yet?" or "Did the GOSI calculator actually help them?" Each user is a black box after signup.

**Aggregate product intelligence:** We can't answer "Where do users drop off in onboarding?" or "Which features drive retention?" or "What are users asking for that we don't have?" Every product decision is a gut call.

**Issue detection:** When a user struggles — hits errors, rage-clicks, abandons a flow, or explicitly complains in chat — nobody knows until they've already left. The notification system sends compliance reminders but has zero awareness of user health.

### What exists today

| System | What it captures | Gap |
|--------|-----------------|-----|
| PostHog (client) | Page views, custom events (minimal) | No structured taxonomy, no server events, no analysis pipeline |
| `ai_usage_log` table | Model, tokens, cost per AI call | No linkage to user satisfaction or outcome |
| Chat history | Full conversation transcripts | No NLP extraction of frustration, requests, or unmet needs |
| Notification system | Compliance reminders sent/opened | One-way push only, no behavioral triggers |
| Getting-started checklist | 5 onboarding steps in localStorage | Not persisted server-side, no completion analytics |
| Tour overlay | Step-by-step guidance | No tracking of which steps users skip or abandon |

The primitives exist. The intelligence doesn't.

---

## 2. Goals & Success Metrics

### Goals

1. **Build a unified event collection layer** that captures every meaningful user interaction server-side
2. **Create per-user behavioral profiles** that score engagement, health, and churn risk
3. **Detect issues automatically** — frustration signals, feature confusion, unmet needs — before users complain
4. **Generate aggregate product insights** — drop-off analysis, feature adoption, value realization, unmet needs
5. **Power semi-autonomous nudges** — in-app messages and emails triggered by behavior, not just calendar dates

### Success Metrics

| Metric | Current | Target (Phase 1) | Target (Phase 3) | How to Measure |
|--------|---------|-------------------|-------------------|----------------|
| Events captured per user/day | ~2 (page views) | 30-50 | 50-100 | `user_events` table |
| Mean time to detect frustrated user | ∞ (never) | < 24 hours | < 1 hour | Frustration signal → alert latency |
| Onboarding completion rate | Unknown | Measurable | +25% improvement | Checklist completion events |
| Feature adoption visibility | 0 features tracked | 8 core features | All features | Adoption heatmap |
| Churn prediction accuracy | N/A | N/A (heuristic) | >70% precision | Model eval |
| Nudge-driven reactivation rate | 0% | 5% | 15% | Nudge sent → user returns within 48h |

---

## 3. Architecture Philosophy

### Heuristics-first, graduate to ML

At <100 users, we don't have the data volume for real ML models. The architecture must:

1. **Phase 1 (0-100 users):** Rule-based scoring, threshold triggers, Haiku-powered text classification for chat analysis. Simple heuristic models that a single developer can maintain.
2. **Phase 2 (100-500 users):** Aggregate enough labeled data to train lightweight models. Introduce basic collaborative filtering ("users like you also..."). Start A/B testing nudge strategies.
3. **Phase 3 (500+ users):** Graduate to proper ML — churn prediction models, clustering for user segments, recommendation engine for next-best-action. The event schema and feature store designed in Phase 1 must support this without migration.

### Supabase-native

All event storage, scoring, and triggers run inside Supabase (Postgres + Edge Functions + Cron). No external ML infrastructure until Phase 3. This keeps operational cost near zero while we're pre-revenue at scale.

### Privacy by design

Saudi users are privacy-conscious. All behavioral data is tied to `business_id` (not personal identity), aggregation happens server-side, and the `data_sharing_consent` field on `businesses` gates whether anonymized data enters aggregate analytics. Chat transcripts used for NLP are processed by Haiku and only the extracted signals (frustration score, topic tags) are stored — never raw messages.

---

## 4. Events Taxonomy

### 4.1 Event Schema

Every interaction flows through a single `user_events` table with a consistent schema:

```sql
CREATE TABLE user_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    event_name TEXT NOT NULL,
    event_category TEXT NOT NULL,
    properties JSONB DEFAULT '{}'::jsonb,
    session_id UUID,
    page_path TEXT,
    locale TEXT CHECK (locale IN ('en', 'ar')),
    device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hot query indexes
CREATE INDEX idx_user_events_business ON user_events(business_id, created_at DESC);
CREATE INDEX idx_user_events_name ON user_events(event_name, created_at DESC);
CREATE INDEX idx_user_events_category ON user_events(event_category, created_at DESC);
CREATE INDEX idx_user_events_session ON user_events(session_id);
CREATE INDEX idx_user_events_user ON user_events(user_id, created_at DESC);

-- Partitioning by month (Phase 2 — when volume demands it)
-- For now, a single table with time-based indexes is sufficient at <100 users
```

### 4.2 Event Categories & Names

#### Navigation Events (`navigation`)

| Event Name | Properties | Trigger Point |
|-----------|-----------|--------------|
| `page_view` | `{ path, referrer, time_on_previous_page_ms }` | Client: route change |
| `page_exit` | `{ path, time_on_page_ms, scroll_depth_pct }` | Client: beforeunload / route change |
| `locale_switch` | `{ from, to }` | Client: language toggle |

#### Feature Events (`feature`)

| Event Name | Properties | Trigger Point |
|-----------|-----------|--------------|
| `bookkeeper.upload_start` | `{ source: 'csv'|'pdf'|'receipt', file_count }` | API: upload endpoint |
| `bookkeeper.upload_complete` | `{ source, tx_count, duration_ms, ai_model }` | API: parse complete |
| `bookkeeper.upload_fail` | `{ source, error_type, file_size }` | API: error handler |
| `bookkeeper.report_view` | `{ report_type: 'vat'|'pl'|'cashflow'|'forecast' }` | Client: report tab |
| `bookkeeper.report_export` | `{ report_type, format: 'pdf'|'xlsx' }` | Client: export click |
| `bookkeeper.tx_edit` | `{ field_changed, was_ai_categorized }` | API: transaction update |
| `bookkeeper.tx_review` | `{ accepted: bool, original_category, new_category }` | API: review action |
| `compliance.calendar_view` | `{ filter_applied, obligations_visible }` | Client: calendar mount |
| `compliance.obligation_complete` | `{ type, days_before_due }` | API: status update |
| `compliance.obligation_overdue` | `{ type, days_overdue }` | Cron: daily check |
| `team.member_add` | `{ nationality, has_salary }` | API: team insert |
| `team.gosi_calculate` | `{ member_count, total_amount }` | Client: GOSI calc |
| `documents.upload` | `{ type, file_size, mime_type }` | API: doc upload |
| `documents.upload_complete` | `{ type, ai_confidence, extracted_fields }` | API: AI extraction done |
| `documents.view` | `{ type, age_days }` | Client: doc view |
| `billing.plan_view` | `{ current_plan }` | Client: billing page |
| `billing.plan_change` | `{ from_plan, to_plan }` | API: Stripe webhook |

#### Chat Events (`chat`)

| Event Name | Properties | Trigger Point |
|-----------|-----------|--------------|
| `chat.message_sent` | `{ message_length, is_arabic, has_attachment }` | API: chat route |
| `chat.tool_used` | `{ tool_name, confirmed: bool }` | API: tool execution |
| `chat.tool_rejected` | `{ tool_name, reason }` | API: confirmation denied |
| `chat.response_received` | `{ response_length, duration_ms, model }` | API: stream complete |
| `chat.session_start` | `{ entry_point }` | Client: chat open |
| `chat.session_end` | `{ message_count, duration_ms }` | Client: chat close / timeout |
| `chat.frustration_signal` | `{ signal_type, confidence, raw_excerpt }` | Server: Haiku classifier |

#### Onboarding Events (`onboarding`)

| Event Name | Properties | Trigger Point |
|-----------|-----------|--------------|
| `onboarding.step_complete` | `{ step_name, time_since_signup_ms }` | API: action match |
| `onboarding.step_skip` | `{ step_name }` | Client: skip action |
| `onboarding.checklist_complete` | `{ total_time_ms }` | Client: all 5 done |
| `onboarding.tour_step_view` | `{ step_index, step_name }` | Client: tour advance |
| `onboarding.tour_dismiss` | `{ step_index, completed_pct }` | Client: tour close |

#### System Events (`system`)

| Event Name | Properties | Trigger Point |
|-----------|-----------|--------------|
| `system.error` | `{ error_type, path, status_code, message }` | API: error middleware |
| `system.rate_limit_hit` | `{ tier, calls_today, limit }` | API: rate limiter |
| `system.slow_response` | `{ path, duration_ms, threshold_ms }` | API: response time > 3s |
| `notification.email_sent` | `{ template, obligation_type }` | API: notification send |
| `notification.email_opened` | `{ template }` | Email: tracking pixel |
| `notification.nudge_shown` | `{ nudge_type, trigger_rule }` | Client: nudge render |
| `notification.nudge_clicked` | `{ nudge_type, action_url }` | Client: nudge CTA |
| `notification.nudge_dismissed` | `{ nudge_type }` | Client: nudge close |

---

## 5. Per-User Behavioral Profiles

### 5.1 User Profile Schema

A materialized profile that's recomputed daily (Phase 1: cron, Phase 3: real-time triggers):

```sql
CREATE TABLE user_profiles (
    business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,

    -- Engagement scores (0-100)
    engagement_score INTEGER NOT NULL DEFAULT 0,
    health_score INTEGER NOT NULL DEFAULT 0,
    churn_risk_score INTEGER NOT NULL DEFAULT 0,

    -- Activity metrics
    total_sessions INTEGER NOT NULL DEFAULT 0,
    total_events INTEGER NOT NULL DEFAULT 0,
    last_active_at TIMESTAMPTZ,
    days_since_signup INTEGER NOT NULL DEFAULT 0,
    days_active_last_30 INTEGER NOT NULL DEFAULT 0,
    avg_session_duration_ms INTEGER NOT NULL DEFAULT 0,
    streak_days INTEGER NOT NULL DEFAULT 0,

    -- Feature adoption (bitmap-style — which features have they used?)
    features_used TEXT[] DEFAULT '{}',
    features_used_count INTEGER NOT NULL DEFAULT 0,
    primary_feature TEXT, -- most-used feature
    primary_locale TEXT DEFAULT 'en',

    -- Onboarding
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    onboarding_steps_done INTEGER NOT NULL DEFAULT 0,
    onboarding_stalled_at TEXT, -- step name where they stopped

    -- AI interaction
    total_ai_calls INTEGER NOT NULL DEFAULT 0,
    ai_calls_last_7d INTEGER NOT NULL DEFAULT 0,
    chat_messages_total INTEGER NOT NULL DEFAULT 0,
    avg_chat_satisfaction NUMERIC(3, 2), -- derived from frustration analysis

    -- Issue signals
    frustration_events_7d INTEGER NOT NULL DEFAULT 0,
    errors_encountered_7d INTEGER NOT NULL DEFAULT 0,
    rate_limits_hit_7d INTEGER NOT NULL DEFAULT 0,
    unresolved_issues TEXT[] DEFAULT '{}',

    -- Lifecycle stage
    lifecycle_stage TEXT NOT NULL DEFAULT 'new',
    lifecycle_changed_at TIMESTAMPTZ,

    -- Nudge state
    last_nudge_sent_at TIMESTAMPTZ,
    nudges_sent_total INTEGER NOT NULL DEFAULT 0,
    nudges_clicked_total INTEGER NOT NULL DEFAULT 0,

    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lifecycle stages:
-- 'new'        → signed up, < 3 days, hasn't completed onboarding
-- 'onboarding' → actively going through setup steps
-- 'activated'  → completed onboarding + used ≥2 features in first week
-- 'engaged'    → active ≥3 days in last 7, using ≥2 features
-- 'at_risk'    → was engaged, now inactive 5+ days or frustration spike
-- 'dormant'    → no activity for 14+ days
-- 'churned'    → no activity for 30+ days
```

### 5.2 Engagement Scoring (Phase 1 — Heuristic)

The engagement score is a weighted sum, recalculated daily by a Supabase cron Edge Function:

```typescript
function calculateEngagementScore(profile: UserProfile, events7d: UserEvent[]): number {
  let score = 0

  // Recency (0-30 points)
  const daysSinceActive = daysBetween(profile.last_active_at, now())
  if (daysSinceActive === 0) score += 30
  else if (daysSinceActive === 1) score += 25
  else if (daysSinceActive <= 3) score += 15
  else if (daysSinceActive <= 7) score += 5
  // else 0

  // Frequency (0-25 points)
  const activeDays7d = countDistinctDays(events7d)
  score += Math.min(25, activeDays7d * 5) // 5 pts per active day, max 25

  // Depth — feature breadth (0-25 points)
  const featuresUsed7d = countDistinctFeatures(events7d)
  score += Math.min(25, featuresUsed7d * 5) // 5 pts per feature, max 25

  // Value actions (0-20 points) — actions that correlate with retention
  const valueActions = events7d.filter(e =>
    ['bookkeeper.upload_complete', 'bookkeeper.report_view',
     'compliance.obligation_complete', 'team.gosi_calculate',
     'bookkeeper.report_export'].includes(e.event_name)
  )
  score += Math.min(20, valueActions.length * 4)

  return Math.min(100, score)
}
```

### 5.3 Health Score (Phase 1 — Heuristic)

Health combines engagement with absence of negative signals:

```typescript
function calculateHealthScore(engagementScore: number, profile: UserProfile): number {
  let health = engagementScore // Start from engagement

  // Penalize frustration signals
  health -= profile.frustration_events_7d * 5 // -5 per frustration event
  health -= profile.errors_encountered_7d * 2 // -2 per error
  health -= profile.rate_limits_hit_7d * 3    // -3 per rate limit hit

  // Bonus for positive signals
  if (profile.onboarding_completed) health += 10
  if (profile.streak_days >= 3) health += 5
  if (profile.nudges_clicked_total > 0) health += 5

  return Math.max(0, Math.min(100, health))
}
```

### 5.4 Churn Risk Score (Phase 1 — Heuristic)

Inverse of health, weighted toward inactivity:

```typescript
function calculateChurnRisk(profile: UserProfile): number {
  let risk = 0

  // Inactivity is the strongest signal
  const daysSinceActive = daysBetween(profile.last_active_at, now())
  if (daysSinceActive >= 14) risk += 40
  else if (daysSinceActive >= 7) risk += 25
  else if (daysSinceActive >= 3) risk += 10

  // Declining engagement (was engaged, now isn't)
  if (profile.lifecycle_stage === 'at_risk') risk += 20

  // Never completed onboarding
  if (!profile.onboarding_completed && profile.days_since_signup > 7) risk += 15

  // Low feature adoption
  if (profile.features_used_count <= 1) risk += 10

  // Frustration without resolution
  if (profile.frustration_events_7d > 0 && profile.unresolved_issues.length > 0) risk += 15

  // Never returned after hitting rate limit
  if (profile.rate_limits_hit_7d > 0 && daysSinceActive >= 2) risk += 10

  return Math.min(100, risk)
}
```

### 5.5 Lifecycle Transitions

```
new ──(completes first onboarding step)──→ onboarding
onboarding ──(completes checklist + uses ≥2 features in week 1)──→ activated
activated ──(active ≥3 days in last 7)──→ engaged
engaged ──(inactive 5+ days OR frustration spike)──→ at_risk
at_risk ──(returns and resumes activity)──→ engaged
at_risk ──(inactive 14+ days)──→ dormant
dormant ──(returns)──→ engaged
dormant ──(inactive 30+ days)──→ churned
churned ──(returns)──→ engaged
```

---

## 6. Issue Intelligence Pipeline

### 6.1 Frustration Signal Detection

Three signal sources, all feeding into `chat.frustration_signal` events:

#### Signal 1: Chat Sentiment Analysis (Haiku-powered)

After every chat message, run a lightweight Haiku classification (cost: ~$0.001/message):

```typescript
const FRUSTRATION_CLASSIFIER_PROMPT = `
You are a frustration detector for a Saudi business management platform.
Analyze this user message and respond with JSON only.

Signals to look for:
- Explicit complaints: "this doesn't work", "مايشتغل", "broken"
- Repeated questions (same topic asked differently)
- Confusion: "I don't understand", "مافهمت", "how do I..."
- Giving up language: "never mind", "forget it", "خلاص"
- Escalation requests: "let me talk to someone", "support"
- Arabic frustration markers: "والله", "يخي", "ليش"

Respond: { "frustrated": boolean, "confidence": 0.0-1.0, "signal_type": "complaint"|"confusion"|"giving_up"|"escalation"|"none", "topic": "brief topic", "severity": "low"|"medium"|"high" }
`
```

This classification runs **asynchronously** — it does not slow down the chat response. The Haiku call fires after the Sonnet/Haiku chat response has already streamed back to the user.

#### Signal 2: Behavioral Patterns (Rule-based)

Detected server-side without any AI call:

| Pattern | Detection Rule | Severity |
|---------|---------------|----------|
| Rage-clicking | Same button/action >3 times in 5 seconds | Medium |
| Flow abandonment | Started upload → left page within 10s without completion | Low |
| Error spiral | >3 errors in one session | High |
| Rate limit frustration | Hit rate limit → left platform within 2 minutes | High |
| Feature confusion | Visited same settings/help page >3 times in one session | Medium |
| Chat escalation | Asked same question in 3+ different phrasings | High |

#### Signal 3: Explicit Feedback (Direct)

- Thumbs down on AI responses (if implemented)
- Support/feedback form submissions
- Chat messages explicitly tagged as issues by the classifier

### 6.2 Issue Classification & Tracking

Detected issues are stored and classified:

```sql
CREATE TABLE detected_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

    -- Classification
    issue_type TEXT NOT NULL CHECK (issue_type IN (
        'bug',            -- something is broken
        'ux_confusion',   -- user can't figure out how to do something
        'missing_feature', -- user wants something that doesn't exist
        'performance',    -- slow response, timeout
        'rate_limit',     -- hit usage limits
        'data_quality'    -- AI categorized wrong, OCR failed, etc.
    )),
    severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'wont_fix')),

    -- Context
    title TEXT NOT NULL,
    description TEXT,
    source TEXT NOT NULL CHECK (source IN ('chat_nlp', 'behavioral', 'explicit', 'system')),
    evidence JSONB DEFAULT '[]'::jsonb, -- array of event_ids that contributed to detection
    feature_area TEXT, -- 'bookkeeper', 'compliance', 'team', 'chat', 'documents', 'billing'
    
    -- Resolution
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    auto_resolved BOOLEAN DEFAULT false, -- true if user's subsequent behavior shows resolution

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_issues_business ON detected_issues(business_id, created_at DESC);
CREATE INDEX idx_issues_status ON detected_issues(status, severity);
CREATE INDEX idx_issues_type ON detected_issues(issue_type, created_at DESC);
```

### 6.3 Issue Aggregation for Product Insights

A nightly cron aggregates individual issues into product-level signals:

```sql
CREATE TABLE issue_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Aggregated counts
    issue_type TEXT NOT NULL,
    feature_area TEXT,
    total_count INTEGER NOT NULL DEFAULT 0,
    unique_users_affected INTEGER NOT NULL DEFAULT 0,
    avg_severity NUMERIC(3, 2),
    
    -- Trend
    count_change_pct NUMERIC(5, 2), -- vs previous period
    
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT uq_issue_agg UNIQUE (period_start, period_end, issue_type, feature_area)
);
```

---

## 7. Aggregate Product Analytics

### 7.1 Drop-off Analysis

**What it answers:** "Where do users abandon flows, and how many never come back?"

**Implementation (Phase 1 — SQL views + nightly cron):**

```sql
-- Materialized view: funnel drop-offs per flow
CREATE MATERIALIZED VIEW mv_funnel_dropoffs AS
WITH onboarding_funnel AS (
    SELECT
        business_id,
        MAX(CASE WHEN event_name = 'onboarding.step_complete'
            AND properties->>'step_name' = 'uploadCR' THEN 1 ELSE 0 END) AS step_1_cr,
        MAX(CASE WHEN event_name = 'onboarding.step_complete'
            AND properties->>'step_name' = 'uploadDocument' THEN 1 ELSE 0 END) AS step_2_doc,
        MAX(CASE WHEN event_name = 'onboarding.step_complete'
            AND properties->>'step_name' = 'checkCalendar' THEN 1 ELSE 0 END) AS step_3_cal,
        MAX(CASE WHEN event_name = 'onboarding.step_complete'
            AND properties->>'step_name' = 'addTransaction' THEN 1 ELSE 0 END) AS step_4_tx,
        MAX(CASE WHEN event_name = 'onboarding.step_complete'
            AND properties->>'step_name' = 'addTeamMember' THEN 1 ELSE 0 END) AS step_5_team
    FROM user_events
    GROUP BY business_id
)
SELECT
    COUNT(*) AS total_users,
    SUM(step_1_cr) AS completed_step_1,
    SUM(step_2_doc) AS completed_step_2,
    SUM(step_3_cal) AS completed_step_3,
    SUM(step_4_tx) AS completed_step_4,
    SUM(step_5_team) AS completed_step_5,
    -- Drop-off rates
    ROUND(100.0 * (COUNT(*) - SUM(step_1_cr)) / NULLIF(COUNT(*), 0), 1) AS drop_before_step_1_pct,
    ROUND(100.0 * (SUM(step_1_cr) - SUM(step_2_doc)) / NULLIF(SUM(step_1_cr), 0), 1) AS drop_1_to_2_pct,
    ROUND(100.0 * (SUM(step_2_doc) - SUM(step_3_cal)) / NULLIF(SUM(step_2_doc), 0), 1) AS drop_2_to_3_pct,
    ROUND(100.0 * (SUM(step_3_cal) - SUM(step_4_tx)) / NULLIF(SUM(step_3_cal), 0), 1) AS drop_3_to_4_pct,
    ROUND(100.0 * (SUM(step_4_tx) - SUM(step_5_team)) / NULLIF(SUM(step_4_tx), 0), 1) AS drop_4_to_5_pct
FROM onboarding_funnel;
```

Similar funnels for: bookkeeper upload flow, document upload flow, first-chat-to-value flow.

### 7.2 Feature Adoption Heatmap

**What it answers:** "Which features do users actually use, and when do they discover them?"

**Implementation:**

Track 8 core features and when each user first/last used them:

```sql
CREATE TABLE feature_adoption (
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    feature_name TEXT NOT NULL,
    first_used_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ NOT NULL,
    usage_count_total INTEGER NOT NULL DEFAULT 1,
    usage_count_7d INTEGER NOT NULL DEFAULT 0,
    usage_count_30d INTEGER NOT NULL DEFAULT 0,
    days_since_signup_at_first_use INTEGER,
    
    PRIMARY KEY (business_id, feature_name)
);

-- Core features tracked:
-- 'bookkeeper_upload'   → any bookkeeper.upload_complete event
-- 'bookkeeper_reports'  → any bookkeeper.report_view event
-- 'compliance_calendar' → any compliance.calendar_view event
-- 'team_management'     → any team.member_add event
-- 'gosi_calculator'     → any team.gosi_calculate event
-- 'document_vault'      → any documents.upload event
-- 'ai_chat'             → any chat.session_start event
-- 'billing'             → any billing.plan_view event
```

**Aggregate query (product dashboard):**

```sql
SELECT
    feature_name,
    COUNT(*) AS total_adopters,
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM businesses), 1) AS adoption_pct,
    ROUND(AVG(days_since_signup_at_first_use), 1) AS avg_days_to_discover,
    ROUND(AVG(usage_count_30d), 1) AS avg_monthly_usage
FROM feature_adoption
GROUP BY feature_name
ORDER BY adoption_pct DESC;
```

### 7.3 Value Realization Tracking

**What it answers:** "When does a user first get real value from the platform, and what drove it?"

**Definition of "value realized":** A user has realized value when they complete at least one of these "aha moments":

| Aha Moment | Event Trigger | Why it matters |
|-----------|--------------|----------------|
| First successful upload | `bookkeeper.upload_complete` with `tx_count > 0` | They got data in |
| First report viewed | `bookkeeper.report_view` | They saw their numbers |
| First obligation completed | `compliance.obligation_complete` | Platform saved them from a penalty |
| First AI chat value | Chat session with tool_used + no frustration signal | AI assistant actually helped |
| First report exported | `bookkeeper.report_export` | They took data OUT of the platform (high trust) |

```sql
CREATE TABLE value_realization (
    business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    first_aha_moment TEXT,
    first_aha_at TIMESTAMPTZ,
    time_to_value_hours NUMERIC(10, 2), -- hours from signup to first aha
    aha_moments_total INTEGER NOT NULL DEFAULT 0,
    aha_moments JSONB DEFAULT '[]'::jsonb, -- [{moment, timestamp}]
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Product insight query:**

```sql
SELECT
    first_aha_moment,
    COUNT(*) AS users,
    ROUND(AVG(time_to_value_hours), 1) AS avg_hours_to_value,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_to_value_hours), 1) AS median_hours
FROM value_realization
WHERE first_aha_at IS NOT NULL
GROUP BY first_aha_moment;
```

### 7.4 Unmet Needs Mining

**What it answers:** "What are users asking for that we don't have?"

**Implementation:** Extract feature requests and unmet needs from chat transcripts using Haiku classification.

After each chat session ends, run a batch classifier:

```typescript
const UNMET_NEEDS_PROMPT = `
Analyze this chat transcript from a Saudi business management platform (Mugdm).
Extract any unmet needs — things the user wanted to do but couldn't, features they asked about that don't exist, or workarounds they had to take.

Respond with JSON:
{
  "unmet_needs": [
    {
      "need": "brief description",
      "need_ar": "وصف مختصر بالعربي",
      "category": "integration"|"feature"|"automation"|"reporting"|"localization"|"other",
      "urgency": "nice_to_have"|"important"|"critical",
      "direct_quote": "what the user actually said (truncated to 100 chars)"
    }
  ]
}

Return empty array if no unmet needs detected.
`
```

```sql
CREATE TABLE unmet_needs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    need TEXT NOT NULL,
    need_ar TEXT,
    category TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'nice_to_have',
    source TEXT NOT NULL DEFAULT 'chat_nlp',
    evidence TEXT, -- direct quote or event reference
    vote_count INTEGER NOT NULL DEFAULT 1, -- incremented when multiple users express same need
    canonical_need_id UUID REFERENCES unmet_needs(id), -- for deduplication
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'planned', 'shipped', 'wont_do')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_unmet_needs_category ON unmet_needs(category, vote_count DESC);
CREATE INDEX idx_unmet_needs_status ON unmet_needs(status);
```

**Deduplication:** When a new unmet need is extracted, use Haiku to compare it against the top 50 existing needs (by vote_count). If confidence > 0.8 match, increment `vote_count` on the existing record and set `canonical_need_id` on the new one instead of creating a duplicate.

---

## 8. Semi-Autonomous Nudge System

### 8.1 Nudge Architecture

Nudges are behavioral triggers that send in-app messages or emails to users based on their profile state and event patterns. They are "semi-autonomous" — the rules are defined by us, but the system fires them automatically without human intervention.

```sql
CREATE TABLE nudge_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Trigger conditions (evaluated against user_profiles)
    trigger_conditions JSONB NOT NULL,
    -- Example: {"lifecycle_stage": "new", "onboarding_steps_done": {"$lt": 2}, "days_since_signup": {"$gte": 3}}
    
    -- Delivery
    channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'both')),
    template_key TEXT NOT NULL,
    template_vars JSONB DEFAULT '{}'::jsonb,
    
    -- Constraints
    max_sends_per_user INTEGER NOT NULL DEFAULT 1,
    cooldown_hours INTEGER NOT NULL DEFAULT 72, -- min hours between nudges to same user
    priority INTEGER NOT NULL DEFAULT 50, -- higher = more important (breaks ties)
    
    -- Targeting
    locale TEXT, -- null = both locales
    min_health_score INTEGER, -- don't nudge users who are already doing well
    max_health_score INTEGER, -- don't nudge users who are too far gone
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE nudge_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nudge_rule_id UUID NOT NULL REFERENCES nudge_rules(id),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    clicked_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    converted BOOLEAN DEFAULT false -- true if user took the desired action within 48h
);

CREATE INDEX idx_nudge_log_business ON nudge_log(business_id, sent_at DESC);
CREATE INDEX idx_nudge_log_rule ON nudge_log(nudge_rule_id, sent_at DESC);
```

### 8.2 Phase 1 Nudge Rules

| Rule Name | Trigger | Channel | Message (EN) | Message (AR) |
|-----------|---------|---------|-------------|-------------|
| **Onboarding stall** | `lifecycle_stage = 'new'` AND `onboarding_steps_done < 2` AND `days_since_signup >= 3` | Both | "You're 2 steps away from unlocking your dashboard. Upload your CR to get started." | "باقي خطوتين وتفتح لوحة تحكمك. ارفع السجل التجاري وابدأ." |
| **First upload nudge** | `lifecycle_stage = 'onboarding'` AND `features_used` not contains `bookkeeper_upload` AND `days_since_signup >= 5` | In-app | "Tip: Upload a bank statement or receipt to see Mugdm's bookkeeping magic." | "نصيحة: ارفع كشف حساب أو فاتورة وشوف سحر مُقدِم في المحاسبة." |
| **Compliance reminder boost** | `compliance.obligation_overdue` event AND `health_score < 50` | Email | "⚠️ You have an overdue obligation. Mugdm can help you stay compliant — check your calendar." | "⚠️ عندك التزام متأخر. مُقدِم يقدر يساعدك تلتزم — تفقد تقويمك." |
| **Re-engagement** | `lifecycle_stage = 'at_risk'` AND `days_since_active >= 7` | Email | "We noticed you haven't been around. Your compliance calendar has updates — anything we can help with?" | "لاحظنا إنك ما دخلت من فترة. تقويم الالتزامات عندك تحديثات — نقدر نساعد؟" |
| **Feature discovery** | `features_used_count = 1` AND `engagement_score >= 30` AND `days_since_signup >= 7` | In-app | "Did you know? Mugdm can also track your team's GOSI contributions. Try it →" | "هل تعلم؟ مُقدِم يقدر يتابع اشتراكات قوسي لفريقك. جربها ←" |
| **Value celebration** | `value_realization.aha_moments_total` increments | In-app | "🎉 You just generated your first VAT report! Export it as PDF for your records." | "🎉 توك طلعت أول تقرير ضريبة! صدّره PDF لسجلاتك." |
| **Churn prevention** | `churn_risk_score >= 70` AND `lifecycle_stage IN ('at_risk', 'dormant')` | Email | Personal note from product: "We're building Mugdm for businesses like yours. What's one thing we could do better?" | رسالة شخصية: "نبني مُقدِم لأعمال مثل أعمالك. وش الشي اللي نقدر نحسنه؟" |

### 8.3 Nudge Execution Flow

```
Cron (every 6 hours)
  │
  ├─ 1. Load all user_profiles where lifecycle_stage != 'churned'
  │
  ├─ 2. For each profile, evaluate all active nudge_rules
  │     └─ Filter: trigger_conditions match? cooldown respected? max_sends not exceeded?
  │
  ├─ 3. Pick highest-priority matching rule (max 1 nudge per cycle per user)
  │
  ├─ 4. Render message in user's primary_locale
  │
  ├─ 5. Deliver:
  │     ├─ in_app → insert into in_app_notifications table (client polls or uses Supabase realtime)
  │     └─ email → call existing Resend email system with new nudge templates
  │
  └─ 6. Log to nudge_log
```

### 8.4 In-App Notification Table

```sql
CREATE TABLE in_app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    action_url TEXT,
    action_label TEXT,
    type TEXT NOT NULL DEFAULT 'nudge' CHECK (type IN ('nudge', 'system', 'celebration')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    dismissed_at TIMESTAMPTZ,
    nudge_rule_id UUID REFERENCES nudge_rules(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_in_app_notif_business ON in_app_notifications(business_id, is_read, created_at DESC);
```

---

## 9. Event Collection Implementation

### 9.1 Client-Side Collector

A thin wrapper that replaces the current PostHog-only approach:

```typescript
// src/lib/analytics/event-collector.ts

import { trackEvent as trackPostHog } from './posthog'

interface EventPayload {
  event_name: string
  event_category: string
  properties?: Record<string, unknown>
  page_path?: string
}

let sessionId: string | null = null

function getSessionId(): string {
  if (!sessionId) {
    sessionId = crypto.randomUUID()
  }
  return sessionId
}

export async function track(payload: EventPayload) {
  const { event_name, event_category, properties = {} } = payload

  // 1. Send to PostHog (keeps existing dashboards working)
  trackPostHog(event_name, { category: event_category, ...properties })

  // 2. Send to our server-side collector
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name,
        event_category,
        properties,
        session_id: getSessionId(),
        page_path: payload.page_path || window.location.pathname,
        locale: document.documentElement.lang || 'en',
        device_type: getDeviceType(),
      }),
      // Fire-and-forget: don't block UI
      keepalive: true,
    })
  } catch {
    // Silent fail — analytics should never break the app
  }
}

export function trackPageView(path: string, timeOnPrevPage?: number) {
  track({
    event_name: 'page_view',
    event_category: 'navigation',
    properties: { time_on_previous_page_ms: timeOnPrevPage },
    page_path: path,
  })
}

function getDeviceType(): string {
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}
```

### 9.2 Server-Side Collector API

```typescript
// src/app/api/events/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { event_name, event_category, properties, session_id, page_path, locale, device_type } = body

  // Get business_id for this user
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  // Insert event (fire-and-forget on the client, but we await here)
  await supabase.from('user_events').insert({
    business_id: business.id,
    user_id: user.id,
    event_name,
    event_category,
    properties: properties || {},
    session_id,
    page_path,
    locale,
    device_type,
  })

  return NextResponse.json({ ok: true })
}
```

### 9.3 Server-Side Event Emission

For API routes that already handle business logic, emit events inline:

```typescript
// Helper: src/lib/analytics/server-events.ts

import { SupabaseClient } from '@supabase/supabase-js'

export async function emitServerEvent(
  supabase: SupabaseClient,
  businessId: string,
  userId: string,
  event_name: string,
  event_category: string,
  properties: Record<string, unknown> = {}
) {
  // Non-blocking: don't await in the request path
  supabase.from('user_events').insert({
    business_id: businessId,
    user_id: userId,
    event_name,
    event_category,
    properties,
  }).then(() => {}).catch(() => {}) // silent fail
}
```

Usage in existing routes (minimal code change):

```typescript
// In src/app/api/chat/route.ts — after tool use
emitServerEvent(supabase, businessId, userId, 'chat.tool_used', 'chat', {
  tool_name: toolName,
  confirmed: true,
})

// In bookkeeper upload route — after parse
emitServerEvent(supabase, businessId, userId, 'bookkeeper.upload_complete', 'feature', {
  source: 'csv',
  tx_count: transactions.length,
  duration_ms: Date.now() - startTime,
})
```

---

## 10. Compute Architecture

### 10.1 Phase 1 — Supabase Cron + Edge Functions (Recommended)

All intelligence runs inside Supabase. No external infrastructure.

| Job | Frequency | Runtime | Est. Cost |
|-----|-----------|---------|-----------|
| **Profile recomputation** | Every 6 hours | Edge Function, ~200ms/user | Free tier (< 500K invocations/month) |
| **Nudge evaluation** | Every 6 hours (after profiles) | Edge Function, ~50ms/user | Free tier |
| **Chat frustration classifier** | Per message (async) | Haiku API call, ~100ms | ~$0.001/message |
| **Unmet needs extraction** | Per chat session end | Haiku API call, ~200ms | ~$0.003/session |
| **Issue aggregation** | Nightly | Edge Function, ~500ms total | Free tier |
| **Materialized view refresh** | Nightly | Postgres, ~1s | Free tier |
| **Feature adoption update** | Every 6 hours | Edge Function, ~100ms/user | Free tier |
| **Value realization check** | Every 6 hours | Edge Function, ~50ms/user | Free tier |

**Total estimated cost at 100 users:** ~$5-15/month (almost entirely Haiku classification calls).

### 10.2 Phase 2 — Add Lightweight Models (100-500 users)

- Move frustration classifier from prompt-based Haiku to a fine-tuned small model (or continue with Haiku — it's cheap enough)
- Add collaborative filtering: "Users who found value in bookkeeper reports also used GOSI calculator within 2 weeks"
- Introduce A/B testing for nudge messages and timing
- Consider Supabase Vectors for semantic similarity in unmet needs deduplication

### 10.3 Phase 3 — Proper ML (500+ users)

- Train a churn prediction model on the labeled data from Phases 1-2
- User clustering for persona discovery (K-means on feature adoption vectors)
- Next-best-action recommendation engine
- Potentially move compute to a lightweight Python service (FastAPI on Railway/Fly.io) if Edge Functions become a bottleneck
- The event schema, feature store (`user_profiles`, `feature_adoption`), and labeled outcomes (`nudge_log.converted`, lifecycle transitions) all serve as training data — no schema migration needed

---

## 11. Integration Points

### 11.1 With Existing Systems

| System | Integration | Change Required |
|--------|------------|----------------|
| **PostHog** | Dual-write: events go to both PostHog AND `user_events` | Wrap existing `trackEvent` calls with new collector |
| **AI usage tracker** (`ai_usage_log`) | Emit `chat.*` events alongside existing logging | Add `emitServerEvent` calls in chat route |
| **Notification system** (Resend) | Nudge emails use same Resend transport + bilingual templates | Add nudge email templates to `templates.ts` |
| **Getting-started checklist** | Persist completions server-side as `onboarding.*` events | Replace localStorage with API call + localStorage cache |
| **Tour overlay** | Emit `onboarding.tour_step_view` and `tour_dismiss` events | Add track() calls to tour component |
| **Compliance cron** | Emit `compliance.obligation_overdue` events during daily check | Add emitServerEvent to notification cron |
| **Chat route** | Add async Haiku classification after each message | Non-blocking post-response hook |
| **Model router** (PRD_AI_OPTIMIZATION) | Use Haiku tier for all classification tasks | Align with multi-model routing strategy |

### 11.2 New API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/events` | POST | Client-side event collection |
| `/api/admin/profiles` | GET | View all user profiles with scores (internal dashboard) |
| `/api/admin/issues` | GET | View detected issues (internal dashboard) |
| `/api/admin/analytics` | GET | Aggregate product analytics (funnels, adoption, etc.) |
| `/api/admin/nudges` | GET/POST | Manage nudge rules |
| `/api/notifications/in-app` | GET | Fetch unread in-app notifications for current user |
| `/api/notifications/in-app/[id]` | PATCH | Mark notification as read/dismissed |

### 11.3 Internal Admin Dashboard (Phase 1.5)

A simple, internal-only page at `/admin/intelligence` that surfaces:

1. **User health table** — all users sorted by churn_risk_score DESC, with engagement/health scores, lifecycle stage, last active date
2. **Issue feed** — recent detected issues, filterable by type/severity/feature
3. **Funnel view** — onboarding drop-off chart
4. **Feature adoption grid** — 8 features × adoption percentage
5. **Unmet needs board** — ranked by vote_count, filterable by category

This does not need to be pretty. A server-rendered page with basic HTML tables is fine for Phase 1. The data is the value, not the UI.

---

## 12. Data Retention & Privacy

### 12.1 Retention Policy

| Data | Retention | Reason |
|------|-----------|--------|
| `user_events` (raw) | 90 days | Sufficient for trend analysis; older events are already rolled into profiles |
| `user_profiles` | Indefinite (updated in place) | Core intelligence asset |
| `detected_issues` | 1 year | Product improvement reference |
| `unmet_needs` | Indefinite | Product roadmap input |
| `nudge_log` | 6 months | Effectiveness analysis |
| `in_app_notifications` | 30 days after dismissed | UX cleanup |
| Chat transcripts (raw) | NOT stored by this system | Only extracted signals (frustration score, topics) are stored |

### 12.2 Privacy Controls

- **Consent gate:** Users with `data_sharing_consent = false` are excluded from aggregate analytics. Their per-user profiles still compute (it's their own data), but they don't contribute to product-level insights.
- **No PII in events:** Event properties never contain names, iqama numbers, or financial amounts. Only counts, categories, and durations.
- **Haiku classification:** Chat messages are sent to Haiku for classification but the raw text is NOT stored in the intelligence tables. Only the structured output (frustration score, topic tag, severity) is persisted.
- **Data deletion:** When a business is deleted (CASCADE), all events, profiles, issues, and nudge logs are automatically removed via foreign key cascades.

---

## 13. Implementation Plan

### Phase 1: Foundation (Weeks 1-4)

**Week 1: Event Infrastructure**
- [ ] Create migration: `user_events`, `user_profiles`, `feature_adoption`, `value_realization` tables
- [ ] Build `/api/events` endpoint
- [ ] Build `event-collector.ts` client wrapper
- [ ] Instrument navigation events (page_view, page_exit, locale_switch)

**Week 2: Feature Events + Server Emission**
- [ ] Add `emitServerEvent` helper
- [ ] Instrument bookkeeper routes (upload, report, tx edit/review)
- [ ] Instrument compliance routes (calendar view, obligation complete)
- [ ] Instrument team, documents, billing events
- [ ] Migrate getting-started checklist to server-persisted events

**Week 3: Profiles + Scoring**
- [ ] Build profile recomputation Edge Function (6-hour cron)
- [ ] Implement engagement, health, and churn risk scoring
- [ ] Implement lifecycle stage transitions
- [ ] Build feature adoption tracking
- [ ] Build value realization tracking

**Week 4: Issue Detection**
- [ ] Create migration: `detected_issues`, `issue_aggregates` tables
- [ ] Implement behavioral frustration pattern detection (server-side rules)
- [ ] Implement chat frustration classifier (async Haiku call)
- [ ] Build nightly issue aggregation cron
- [ ] Build basic `/admin/intelligence` page

### Phase 2: Nudges + Mining (Weeks 5-8)

**Week 5: Nudge System**
- [ ] Create migration: `nudge_rules`, `nudge_log`, `in_app_notifications` tables
- [ ] Build nudge evaluation engine (6-hour cron)
- [ ] Build in-app notification API + client component
- [ ] Create bilingual nudge email templates in Resend

**Week 6: Nudge Rules + Iteration**
- [ ] Implement all 7 Phase 1 nudge rules
- [ ] Add nudge tracking events (shown, clicked, dismissed)
- [ ] Build nudge effectiveness reporting

**Week 7: Unmet Needs Mining**
- [ ] Implement chat session end → Haiku extraction pipeline
- [ ] Create `unmet_needs` table and deduplication logic
- [ ] Add unmet needs view to admin dashboard

**Week 8: Aggregate Analytics**
- [ ] Build materialized views for funnel drop-offs
- [ ] Build feature adoption heatmap view
- [ ] Build value realization report
- [ ] Refresh admin dashboard with all analytics

### Phase 3: Intelligence Graduation (Weeks 9-16+)

- [ ] Evaluate whether Haiku classifier accuracy justifies fine-tuning a dedicated model
- [ ] Introduce A/B testing framework for nudges
- [ ] Build user segmentation (clustering) from feature adoption vectors
- [ ] Train churn prediction model on labeled lifecycle transition data
- [ ] Consider next-best-action recommendations in the AI chat context
- [ ] Evaluate Supabase Vectors for semantic unmet-needs deduplication

---

## 14. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Event volume overwhelms Supabase** | Low (at <100 users) | High | 90-day retention policy + nightly cleanup cron. At 100 users × 50 events/day = 5K rows/day = 450K in 90 days. Well within Postgres capacity. |
| **Haiku classifier produces false positives** | Medium | Medium | Require confidence > 0.7 for frustration signals. Log all classifications for manual review in Phase 1. Tune threshold after 1000 samples. |
| **Nudges feel spammy** | Medium | High | 72-hour cooldown between nudges. Max 1 nudge per evaluation cycle. Nudge suppression for health_score > 70. User can dismiss → no resend of that rule. |
| **Privacy concerns from Saudi users** | Medium | High | Event properties contain no PII. Chat text is classified, not stored. `data_sharing_consent` gates aggregate contribution. Transparent in-app data practices page. |
| **Over-engineering for 20 users** | High | Medium | Phase 1 is deliberately simple: SQL views, heuristic scores, Supabase cron. Total infra cost ~$5-15/month. The complexity is in the *schema design* (which costs nothing to maintain), not the compute. |
| **Dual-write to PostHog + user_events causes drift** | Low | Low | PostHog remains the source-of-truth for client-side analytics. `user_events` is the source-of-truth for behavioral intelligence. They serve different purposes. |

---

## 15. Success Criteria for Phase 1 Launch

Phase 1 is "done" when:

1. ✅ Every feature interaction emits a structured event to `user_events`
2. ✅ Every user has a `user_profiles` row with engagement, health, and churn scores updated every 6 hours
3. ✅ Feature adoption table shows which features each user has discovered
4. ✅ Frustration signals from chat are classified and stored in `detected_issues`
5. ✅ At least 3 nudge rules are firing and tracked
6. ✅ Admin dashboard shows user health table, issue feed, and feature adoption grid
7. ✅ Total monthly infrastructure cost stays under $20

---

## Appendix A: Full Database Migration

The complete migration for Phase 1 tables is defined in Sections 4.1, 5.1, 6.2, 6.3, 7.2, 7.3, 7.4, 8.1, and 8.4 above. These should be consolidated into a single migration file: `supabase/migrations/XXX_intelligence_layer.sql`.

## Appendix B: Relationship to PRD_AI_OPTIMIZATION

This PRD depends on the multi-model routing strategy defined in `PRD_AI_OPTIMIZATION.md`:

- **Haiku for classification:** All NLP tasks in this PRD (frustration detection, unmet needs extraction, need deduplication) use the Haiku tier. The model router should route these tasks to `claude-haiku-4-5` at $0.80/$4 per million tokens.
- **Cost integration:** Haiku classification calls should be logged to `ai_usage_log` with a new `purpose` field: `'intelligence_classification'` to separate intelligence costs from user-facing AI costs.
- **Shared rate limits:** Intelligence classification calls should NOT count toward user-facing daily rate limits. They are platform overhead, not user actions.

## Appendix C: Event Volume Estimates

| Scenario | Events/User/Day | Daily Total (100 users) | 90-Day Storage |
|----------|----------------|------------------------|----------------|
| Light usage | 15-25 | 1,500-2,500 | 135K-225K rows |
| Normal usage | 30-50 | 3,000-5,000 | 270K-450K rows |
| Heavy usage | 50-100 | 5,000-10,000 | 450K-900K rows |

At an average row size of ~500 bytes, 900K rows = ~450MB. Well within Supabase's free tier (500MB database) and trivially handled by any paid plan.
