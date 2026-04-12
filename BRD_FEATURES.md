# Business Requirements Document: Mugdm Platform Features

**Document Version**: 1.0
**Date**: 2026-04-12
**Product**: Mugdm - Data Wallet for Saudi Micro-Enterprises
**Author**: Software Architecture Team

---

## Table of Contents

1. [Multi-LLM AI Routing System](#1-multi-llm-ai-routing-system)
2. [Password Authentication](#2-password-authentication)
3. [Consumption Monitoring and Optimization](#3-consumption-monitoring-and-optimization)
4. [Mobile App (Ideation Phase)](#4-mobile-app-ideation-phase)

---

## 1. Multi-LLM AI Routing System

### 1.1 Business Need

Mugdm currently hardcodes `claude-sonnet-4-20250514` across all AI endpoints (`/api/chat`, `/api/insights`, `/api/analyze-document`, `/api/analyze-receipt`, `/api/parse-statement`). This creates two problems:

- **Cost inefficiency**: Every request -- whether a simple "what's my balance?" or a complex CR document analysis -- uses the same mid-tier model. Simple queries waste money on Sonnet; critical first-use moments (CR analysis during onboarding) would benefit from Opus-level quality.
- **Single point of failure**: When Anthropic rate-limits the account or experiences downtime, all AI features break simultaneously. Users have reported failed document uploads during peak hours.

### 1.2 Stakeholders

| Stakeholder | Interest |
|---|---|
| End Users | Reliable AI responses, fast onboarding, no failed requests |
| Product Team | First-use "aha moment" quality, user retention |
| Engineering | Maintainable routing logic, observable cost tracking |
| Finance | Predictable API costs, per-user cost attribution |
| Operations | Reduced support tickets from rate-limit failures |

### 1.3 Functional Requirements

#### FR-1.1: Task-Based Model Selection

Route AI requests to the appropriate model based on task type:

| Task Category | Primary Model | Rationale |
|---|---|---|
| CR analysis during onboarding (`useCRAgent: true`) | Claude Opus | First impression quality; users decide to stay or leave based on this |
| Onboarding obligation generation | Claude Opus | Accuracy of compliance detection directly affects trust |
| Chat (general Q&A, tool calls) | Claude Sonnet | Good balance of quality and cost for ongoing use |
| Chat (advisory mode) | Claude Sonnet | Complex analysis but acceptable at Sonnet quality |
| Insights generation (`/api/insights`) | Claude Sonnet | Structured output, Sonnet handles JSON well |
| Document analysis (non-CR) | Claude Sonnet | Current behavior, works well |
| Receipt analysis | Claude Haiku | Simple extraction task, high volume |
| Bank statement parsing | Claude Haiku | Structured data extraction, predictable format |

#### FR-1.2: Fallback Provider Chain

When the primary provider (Anthropic) returns a 429 (rate limited) or 5xx error:

1. Retry once with the same model after a 1-second delay.
2. If still failing, fall back to Anthropic Haiku (cheaper model, higher rate limits).
3. If Anthropic is fully down, fall back to OpenAI GPT-4o for critical paths (onboarding, document analysis).
4. If all providers fail, fall back to Google Gemini 2.5 Pro as last resort.
5. Non-critical paths (insights, advisory chat) should return a graceful "temporarily unavailable" rather than burning fallback budget.

#### FR-1.3: LiteLLM Proxy Integration

Evaluate and integrate LiteLLM (or a similar routing proxy) to centralize multi-provider logic:

- Single API interface for all model calls.
- Built-in retry and fallback logic.
- Unified request/response format across providers.
- If LiteLLM adds unacceptable latency (> 50ms overhead), implement a lightweight custom router instead.

#### FR-1.4: Model Selection Transparency

- Model selection is invisible to the user. No UI indication of which model is serving a response.
- Internal logging must record: model used, provider, latency, token count, estimated cost, fallback chain (if triggered).
- Admin dashboard shows model distribution and cost breakdown.

#### FR-1.5: Usage and Cost Tracking Per User Per Model

- Every AI call is logged to a new `ai_usage_log` table with: `user_id`, `business_id`, `model`, `provider`, `input_tokens`, `output_tokens`, `estimated_cost_usd`, `endpoint`, `timestamp`.
- Cost estimation uses a static price table updated when provider pricing changes.
- Monthly cost reports aggregated by user, business, model, and endpoint.

#### FR-1.6: Billing Tier Integration

Current tier structure from `rate-limit.ts`:

| Tier | Daily AI Call Limit | Model Access |
|---|---|---|
| Free | 50 | Sonnet + Haiku only (no Opus after onboarding) |
| Pro | 500 | All models including Opus for document analysis |
| Business | Unlimited (tracked) | All models, priority routing |

- Onboarding CR analysis uses Opus regardless of tier (acquisition cost, not operating cost).
- Free tier users who exhaust 50 calls get a "upgrade to Pro" prompt, not a hard block on critical actions (e.g., expiring document alerts still work).

### 1.4 Non-Functional Requirements

- **Latency**: Model routing decision must add < 10ms to request time. Total fallback chain (all retries) must complete within 30 seconds.
- **Availability**: If one provider is down, AI features must still work for at least 95% of request types.
- **Cost**: Total AI spend must decrease by at least 20% compared to current all-Sonnet baseline, measured over the first month after deployment.
- **Observability**: Every AI call must be traceable from request to response, including fallback chain.

### 1.5 Acceptance Criteria

- [ ] Onboarding CR analysis uses Opus and produces higher extraction confidence than current Sonnet baseline (measured on 20 sample CRs).
- [ ] Chat endpoint automatically uses Sonnet; receipt/statement endpoints use Haiku.
- [ ] When Anthropic returns 429, system falls back to an alternate model within 2 seconds without user-visible error.
- [ ] `ai_usage_log` table records every AI call with accurate token counts and cost estimates.
- [ ] Admin can view a cost breakdown by model, user, and endpoint.
- [ ] Free tier users cannot exceed 50 AI calls/day (existing behavior preserved).
- [ ] No user-facing UI changes; routing is entirely backend.

### 1.6 Dependencies

- Anthropic API keys with access to Opus, Sonnet, and Haiku models.
- OpenAI API key (GPT-4o) for fallback provider.
- Google AI API key (Gemini 2.5 Pro) for fallback provider.
- New Supabase table: `ai_usage_log`.
- LiteLLM evaluation (or custom router build decision).

---

## 2. Password Authentication

### 2.1 Business Need

Users currently authenticate exclusively via magic links (email OTP through Supabase Auth). While magic links reduce signup friction, they create ongoing login friction:

- Users must switch to their email app every time they log in.
- Some Saudi email providers delay magic link delivery by 30-60 seconds.
- Users on shared devices cannot stay logged in and must re-authenticate frequently.
- Magic link expiration (default 1 hour) catches users who open the link later.

Password authentication provides a reliable, instant login method alongside the existing magic link flow.

### 2.2 Stakeholders

| Stakeholder | Interest |
|---|---|
| End Users | Faster, more reliable login; not dependent on email delivery |
| Product Team | Reduced drop-off from login friction |
| Engineering | Leveraging existing Supabase auth infrastructure |
| Security | Password policy enforcement, no weakening of existing auth |

### 2.3 Functional Requirements

#### FR-2.1: Post-Signup Password Prompt

- After a user completes their first magic link signup and lands on the dashboard for the first time, display a non-dismissable modal prompting them to set a password.
- The modal must:
  - Explain why: "Set a password so you can log in instantly next time."
  - Include a password field with confirmation.
  - Show a "Skip for now" option that converts the modal to a persistent banner at the top of the dashboard.
  - The banner remains on every page until the user sets a password or dismisses it 3 times (after which it becomes a settings page nudge only).

#### FR-2.2: Password Requirements

- Minimum 8 characters.
- At least 1 numeric digit.
- No maximum length restriction (Supabase handles hashing).
- Real-time validation feedback as the user types.
- Show password strength indicator (weak/medium/strong) but do not block on "weak" -- only block if minimum requirements are not met.

#### FR-2.3: Password Setting Implementation

- Use Supabase `auth.updateUser({ password })` to set the password on the authenticated user session.
- This is a single API call; no additional backend route needed.
- After password is set, store a `has_password: true` flag in user metadata (`auth.updateUser({ data: { has_password: true } })`) to control whether the prompt appears.

#### FR-2.4: Dual Login Support

- The login page (`/[locale]/(auth)/login`) must offer both options:
  - **Email + Password** form (primary, shown first).
  - **Magic Link** option (secondary, "Or sign in with a magic link" below the form).
- If a user has no password set and tries password login, show: "No password set. We've sent you a magic link instead." and trigger the magic link flow automatically.
- If a user enters the wrong password, show standard "Invalid email or password" error.
- "Forgot password" link triggers Supabase `auth.resetPasswordForEmail()`.

#### FR-2.5: Password Change

- Available in the existing Settings page (`/[locale]/(app)/settings`).
- Requires current password verification before allowing change.
- Same validation rules as initial password setting.

### 2.4 Non-Functional Requirements

- **Security**: Passwords are hashed by Supabase (bcrypt). No plaintext storage. Rate-limit login attempts (Supabase built-in).
- **Accessibility**: Password fields must support screen readers and Arabic labels. Show/hide password toggle.
- **Performance**: Password login must complete in < 1 second (Supabase auth is fast).
- **Backwards Compatibility**: Existing magic-link-only users continue to work. No forced migration.

### 2.5 Acceptance Criteria

- [ ] First-time dashboard visit after signup shows the password-setting modal.
- [ ] User can set a password meeting the 8+ chars, 1+ digit requirement.
- [ ] User can subsequently log in with email + password.
- [ ] User can still log in with magic link even after setting a password.
- [ ] "Forgot password" sends a reset email and allows setting a new password.
- [ ] The password prompt does not reappear after the user has set a password.
- [ ] Login page works correctly in both English and Arabic (`next-intl` integration).
- [ ] Password change works from the Settings page.

### 2.6 Dependencies

- Supabase Auth (already integrated via `@supabase/ssr` and `@supabase/supabase-js`).
- No new backend routes required -- `auth.updateUser()` and `auth.signInWithPassword()` are client-side Supabase SDK calls.
- UI components: existing Radix UI dialog for modal, existing input components.
- `next-intl` translations for all new strings (English + Arabic).

---

## 3. Consumption Monitoring and Optimization

### 3.1 Business Need

As Mugdm scales, AI API costs are the largest variable expense. Currently:

- The `usage/tracker.ts` provides basic stats (AI calls today, documents stored, team members) but no historical tracking, no per-model breakdown, and no cost visibility.
- Rate limiting exists (`rate-limit.ts`) but only counts document uploads and bank statement uploads -- it misses chat calls, insights, and receipt analysis.
- There is no admin view of platform-wide consumption.
- Users have no visibility into how close they are to their daily limit until they hit it.

### 3.2 Stakeholders

| Stakeholder | Interest |
|---|---|
| End Users | Know how many AI calls remain, avoid surprise blocks |
| Product Team | Usage patterns inform pricing decisions |
| Engineering | Accurate rate limiting across all endpoints |
| Finance | Per-user cost attribution, margin analysis |
| Operations | Early warning on cost spikes, abuse detection |

### 3.3 Functional Requirements

#### FR-3.1: Comprehensive AI Call Counting

Update rate limiting to count ALL AI-consuming endpoints, not just documents and bank statements:

| Endpoint | Currently Counted | Should Count |
|---|---|---|
| `/api/analyze-document` | Yes (via `documents` table) | Yes |
| `/api/parse-statement` | Yes (via `bank_statement_uploads` table) | Yes |
| `/api/chat` | No (uses `enforceRateLimit` but not counted in daily total) | Yes |
| `/api/insights` | No | Yes |
| `/api/analyze-receipt` | No | Yes |
| `/api/onboarding` (CR agent) | No | No (exempt -- acquisition cost) |

Implementation: Write to `ai_usage_log` (from Feature 1) on every AI call, and count from that table instead of deriving counts from `documents` and `bank_statement_uploads`.

#### FR-3.2: User-Facing Usage Dashboard

Add a usage section to the existing Billing page (`/[locale]/(app)/billing`):

- **Today's AI calls**: progress bar showing used/limit (e.g., "32 of 50 calls used today").
- **This month's breakdown**: bar chart showing daily AI call volume for the current month.
- **Per-business split**: for users with multiple businesses, show which business consumes the most.
- **Model breakdown** (Pro/Business tier only): pie chart showing Opus vs Sonnet vs Haiku distribution.

#### FR-3.3: Approaching-Limit Alerts

- At 80% of daily limit (40/50 for free tier): show a yellow toast notification: "You have 10 AI calls remaining today."
- At 100%: show a blocking message with upgrade CTA. Critical actions (expiring document alerts) still work via a reserved 5-call buffer.
- Alerts appear once per threshold crossing, not on every subsequent request.

#### FR-3.4: Cost Tracking Per Model

Internal tracking (not user-facing) of estimated cost per AI call:

| Model | Input Cost (per 1M tokens) | Output Cost (per 1M tokens) |
|---|---|---|
| Claude Opus | $15.00 | $75.00 |
| Claude Sonnet | $3.00 | $15.00 |
| Claude Haiku | $0.25 | $1.25 |
| GPT-4o (fallback) | $2.50 | $10.00 |
| Gemini 2.5 Pro (fallback) | $1.25 | $10.00 |

These rates are stored as configuration, not hardcoded, so they can be updated without code changes.

#### FR-3.5: Admin Consumption View

A protected admin page showing:

- Total platform AI calls today/this week/this month.
- Total estimated cost by model and by endpoint.
- Top 10 users by consumption.
- Anomaly detection: flag users whose consumption is > 3x the average for their tier.
- Export to CSV for finance reporting.

### 3.4 Non-Functional Requirements

- **Accuracy**: AI call counts must be eventually consistent within 5 seconds. Use the `ai_usage_log` table as source of truth, not derived counts.
- **Performance**: Usage dashboard must load within 1 second. Use Supabase aggregate queries with appropriate indexes.
- **Cost of monitoring**: The monitoring system itself must not add more than 5% overhead to request latency (a single insert per AI call).
- **Data Retention**: Usage logs retained for 12 months. Aggregated monthly summaries retained indefinitely.

### 3.5 Acceptance Criteria

- [ ] All 5 AI endpoints correctly increment the daily usage counter.
- [ ] Billing page shows accurate "calls used today" with progress bar.
- [ ] Monthly usage chart renders with real data from `ai_usage_log`.
- [ ] Toast notification appears at 80% of daily limit.
- [ ] Hard block with upgrade CTA appears at 100% (with reserved buffer for critical alerts).
- [ ] Admin page shows platform-wide consumption with cost estimates.
- [ ] Rate limiting is consistent: a user at exactly 50 calls cannot make call 51 regardless of which endpoint they use.

### 3.6 Dependencies

- Feature 1 (Multi-LLM Routing) must be implemented first, as it creates the `ai_usage_log` table.
- Recharts (already installed) for usage charts on the billing page.
- Admin role/permission check (currently no admin system -- needs a simple `is_admin` flag on the user profile or a Supabase RLS policy).
- PostHog (already integrated) for usage analytics cross-referencing.

---

## 4. Mobile App (Ideation Phase)

### 4.1 Business Need

Over 70% of Mugdm's target users (Saudi micro-enterprise owners) primarily use smartphones for business tasks. The current Next.js web app is responsive but lacks:

- Push notifications for compliance deadlines and expiring documents.
- Native camera access for receipt scanning (the web `react-dropzone` component works but is clunky on mobile).
- App store presence (trust signal for Saudi market; users search the App Store before Google).
- Biometric authentication (Face ID / fingerprint).
- Offline access to critical business data.

### 4.2 Stakeholders

| Stakeholder | Interest |
|---|---|
| End Users | Native mobile experience, push notifications, camera for receipts |
| Product Team | App store presence, higher engagement via push notifications |
| Engineering | Code reuse from web app, maintainable cross-platform approach |
| Marketing | "Available on App Store and Google Play" as trust signal |
| Finance | Development cost vs. user acquisition value |

### 4.3 Functional Requirements

#### FR-4.1: Figma Design Phase (Pre-Development)

No code until designs are reviewed and approved. Design deliverables:

- Mobile navigation pattern: bottom tab bar replacing current sidebar.
- Compact card layouts for dashboard, bookkeeper, and vault screens.
- Swipe gestures: swipe-to-archive on documents, swipe-to-categorize on transactions.
- Receipt capture flow: camera viewfinder with document edge detection overlay.
- Push notification permission prompt and notification center.
- Biometric auth prompt design.
- Arabic RTL layouts for every screen (not mirrored as afterthought -- designed natively).

#### FR-4.2: Technology Evaluation

Evaluate three approaches before committing:

| Approach | Time to MVP | Code Reuse | Native Features | Maintenance |
|---|---|---|---|---|
| Capacitor (wrap Next.js) | 2-3 weeks | ~95% | Push, camera, biometrics via plugins | Single codebase |
| React Native (Expo) | 2-3 months | ~30% (logic only) | Full native API access | Separate codebase |
| PWA Enhancement | 1-2 weeks | 100% | Limited (no iOS push, limited camera) | Single codebase |

**Recommended**: Capacitor for Phase 1 (see PRD_MOBILE_APP.md for detailed rationale).

#### FR-4.3: Phase 1 -- Capacitor MVP

- Wrap the existing Next.js app in a Capacitor shell.
- Add push notification support via `@capacitor/push-notifications`.
- Add camera access via `@capacitor/camera` for receipt scanning.
- Add biometric auth via `@capacitor-community/biometrics`.
- Submit to Apple App Store and Google Play Store.
- Handle deep links for magic link authentication callbacks.

#### FR-4.4: Phase 2 -- Native Enhancements

- Offline data sync: cache critical business data (upcoming obligations, recent transactions) in SQLite via `@capacitor-community/sqlite`.
- Background sync for document uploads over slow connections.
- Haptic feedback on actions (transaction added, document scanned).
- Widget support (iOS): show next upcoming obligation on home screen.

#### FR-4.5: Phase 3 -- Evaluate React Native

If Capacitor performance is insufficient (measured by):
- Time to interactive > 3 seconds on mid-range Android devices.
- Animation frame rate < 30fps on transaction list scrolling.
- User complaints about "web feel" in app store reviews.

Then evaluate a React Native rewrite with Expo, reusing business logic from `src/lib/` but rebuilding UI components natively.

#### FR-4.6: Arabic RTL Native Support

- All layouts must work in RTL mode natively (not CSS `direction: rtl` hacks).
- Swipe gestures must be direction-aware (swipe-right-to-archive in LTR becomes swipe-left in RTL).
- Date pickers must support Hijri calendar (already implemented in web via `src/lib/hijri.ts`).
- Number formatting must respect Arabic-Indic numerals when the user's locale is Arabic.

### 4.4 Non-Functional Requirements

- **Performance**: App must launch to interactive state within 2 seconds on a Samsung Galaxy A14 (common mid-range device in Saudi Arabia).
- **Size**: App bundle must be under 50MB for initial download (important for users on limited data plans).
- **Offline**: Critical data (business profile, upcoming obligations, last 30 days of transactions) must be available offline.
- **Accessibility**: Arabic VoiceOver (iOS) and TalkBack (Android) must work correctly with RTL layouts.
- **Security**: Biometric auth must not store credentials on device -- use Supabase session token secured in the device keychain.

### 4.5 Acceptance Criteria

- [ ] Figma designs for all mobile-specific screens are reviewed and approved before any code is written.
- [ ] Technology decision (Capacitor vs alternatives) is documented in an ADR with benchmarks.
- [ ] Phase 1 MVP runs on both iOS 16+ and Android 10+.
- [ ] Push notifications deliver for: obligation due in 7 days, document expiring in 30 days, daily usage limit approaching.
- [ ] Camera receipt capture produces images that the `/api/analyze-receipt` endpoint can process with >= 90% confidence.
- [ ] App passes Apple App Store and Google Play Store review guidelines.
- [ ] Arabic RTL works natively without visual glitches.
- [ ] Biometric auth works on devices that support it; graceful fallback to password on devices that don't.

### 4.6 Dependencies

- Feature 2 (Password Authentication) must be implemented first -- biometric auth wraps password auth.
- Apple Developer Program membership ($99/year).
- Google Play Developer account ($25 one-time).
- Figma license for design work.
- Push notification infrastructure: Firebase Cloud Messaging (Android) + Apple Push Notification Service (iOS).
- Capacitor v6+ with `@capacitor/push-notifications`, `@capacitor/camera`, `@capacitor-community/biometrics`.
- Mobile-specific QA devices: at minimum iPhone 13 (iOS) and Samsung Galaxy A14 (Android).

---

## Appendix: Feature Dependency Graph

```
Feature 1: Multi-LLM Routing (no dependencies)
    |
    v
Feature 3: Consumption Monitoring (depends on Feature 1's ai_usage_log table)

Feature 2: Password Auth (no dependencies)
    |
    v
Feature 4: Mobile App (depends on Feature 2 for biometric auth flow)
```

**Recommended implementation order**: Feature 2 -> Feature 1 -> Feature 3 -> Feature 4 (Figma phase of Feature 4 can start in parallel with Features 1-3).
