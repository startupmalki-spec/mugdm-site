# Task ID: 22

**Title:** Build AI Dependency Warnings

**Status:** pending

**Dependencies:** 17, 15

**Priority:** medium

**Description:** Create an AI-powered system that analyzes a user's compliance state (obligations + documents) and surfaces contextual warnings about dependencies between obligations.

**Details:**

Create src/app/api/compliance-warnings/route.ts:
- Fetch all obligations with statuses and all documents with expiry states for the user's business
- Send to Claude Text API with prompt:
  'Given these compliance obligations and document states for a Saudi micro-enterprise, identify dependencies and generate warnings. Examples: CR expiry affects MISA renewal, GOSI certificate needed for GOSI payment, Chamber subscription needed for CR confirmation.'
- AI returns array of warnings with: message, severity (info/warning/critical), related_obligation_ids
- Cache warnings per user per day (store in a simple cache table or JSONB field)
- Display in dashboard 'Attention' section

Call once per day per user, not on every page load.
Bilingual warnings (generate in user's language).

**Test Strategy:**

Create a business with expired GOSI certificate and upcoming GOSI payment. Verify AI generates relevant warning. Verify caching (second call returns cached result).
