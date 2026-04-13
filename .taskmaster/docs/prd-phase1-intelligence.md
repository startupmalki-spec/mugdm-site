# Phase 1 — AI Optimization + ML Intelligence

Driver: `PRD_AI_OPTIMIZATION.md` + `PRD_ML_INTELLIGENCE.md`. 24 tasks (T01–T24) tracked in the in-session task list for this implementation cycle; see session TaskList for live status.

## Locked decisions
1. Chat tool-result follow-up call routed to **Haiku** (not eliminated — Anthropic tool-use protocol requires the second call).
2. Confidence escalation threshold: **0.7**.
3. Single-active-business model for event collection (multi-business already exists in DB; collector reads active-business from existing BusinessProvider/cookie).
4. New migration numbers: **008** (ai_response_cache) and **009** (intelligence_layer). PRDs' literal 002/003 are already taken.
5. Cron: **Supabase scheduled functions** (paid plan confirmed).

## Open risks to re-check mid-impl
- `device_type` client detection misclassifies landscape mobile → accept for Phase 1.
- `onboarding_stalled_at` derivation — PRD undefined; deriving from "last onboarding.step_complete > 48h ago AND onboarding_completed=false".
- Event-driven nudge rules (value_celebration, compliance_reminder_boost) need an event-consumer path in addition to the 6h profile scan.

## Maker / Checker / Verifier flow
For each task: (1) Maker agent implements, (2) Checker agent independently reviews the diff, (3) Verifier runs `tsc --noEmit` + `vitest run` + targeted tests. Main thread synthesizes and marks done.
