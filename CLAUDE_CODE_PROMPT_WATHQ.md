# Claude Code Prompt: Wathq API Integration

Copy everything between the triple backticks below and paste it into your Claude Code session.

---

```
I need you to integrate the Wathq API (Saudi Ministry of Commerce) into this Next.js 16 + Supabase codebase. Wathq provides verified commercial registration data via REST API. Read these files first to understand the current architecture:

- `src/app/[locale]/(app)/onboarding/page.tsx` — the onboarding wizard (5 steps: Upload CR → Reveal Animation → Confirm Profile → Calendar Preview → Contact Info)
- `src/lib/agents/cr-agent.ts` — the current CR extraction approach (OCR + QR code scraping via AI)
- `src/app/api/onboarding/route.ts` — the onboarding API that saves business data
- `src/lib/compliance/obligation-generator.ts` — generates compliance obligations from CR data
- `src/lib/validations.ts` — has `isValidCRNumber()` (currently regex-only)
- `supabase/migrations/001_initial_schema.sql` — the businesses table schema

## Context

Currently, the onboarding flow works like this:
1. User uploads a CR document image
2. The CR agent (Sonnet) reads the image, extracts a QR code URL, fetches the MoC verification page, scrapes it, and combines that with OCR data
3. Extracted fields populate the profile form
4. User confirms and submits

This is fragile — 4 chained AI/scraping steps that can each fail. We now have access to the Wathq API which returns structured JSON directly from the Ministry of Commerce database.

**Wathq API details:**
- Base URL: `https://api.wathq.sa/v5/commercialregistration/info/{crNumber}`
- Auth: API key in header `apiKey: <key>`
- The OpenAPI spec is at: https://developer.wathq.sa/sites/default/files/2026-01/Wathq%20Commercial%20Registration%20API%20v6.15.0_0.yaml
- Fetch and read the spec to understand the exact response schema before implementing

**Environment variable:** `WATHQ_API_KEY` (add to `.env.local` template and document it)

## Implementation

### 1. Wathq API Client

Create `src/lib/wathq/client.ts`:
- A typed client for the Wathq Commercial Registration API
- Fetch the OpenAPI spec from the URL above to understand the exact response fields, then create TypeScript types matching the response
- Key function: `lookupCR(crNumber: string): Promise<WathqCRResponse>` 
- Handle errors: invalid CR, not found, API down, rate limited
- Add request timeout (10 seconds)
- The response should include at minimum: trade name (AR/EN), CR status, capital, owners/managers, issuance date, expiry date, activity type, city, legal form
- Map the Wathq response to our existing `CRAgentData` interface from `src/lib/agents/cr-agent.ts` so the rest of the app doesn't need to change

### 2. Wathq API Route

Create `src/app/api/wathq/lookup/route.ts`:
- POST endpoint accepting `{ cr_number: string }`
- Requires authenticated user
- Validates CR number format using `isValidCRNumber()`
- Calls the Wathq client
- Returns mapped business data matching the existing `WizardData` shape from the onboarding page
- Rate limit: max 10 lookups per user per day (to prevent abuse of our Wathq quota)

### 3. Update Onboarding Flow (New Primary Path)

Modify `src/app/[locale]/(app)/onboarding/page.tsx`:

**Add a new Step 0 or modify Step 1** — give users TWO options:
1. **"Enter CR Number"** (new, preferred) — text input for 10-digit CR number + "Lookup" button. On click, call `/api/wathq/lookup`, auto-fill all WizardData fields from the response, then skip to the reveal animation (Step 2) and profile confirmation (Step 3). This is the happy path.
2. **"Upload CR Document"** (existing fallback) — keep the current upload + AI extraction flow as-is for cases where Wathq is down or returns incomplete data.

The UI should make option 1 the prominent/default choice. Option 2 should be a secondary link like "Don't have your CR number? Upload the document instead."

After Wathq lookup succeeds:
- Auto-fill: nameAr, nameEn, crNumber, activityType, city, capital, crIssuanceDate, crExpiryDate, owners
- Show the reveal animation (Step 2) as before — the "magic" feeling of data appearing
- Jump to Step 3 (Confirm Profile) with all fields pre-populated but EDITABLE (user can correct anything)

### 4. Enhance CR Validation

Update `src/lib/validations.ts`:
- `isValidCRNumber()` currently only checks format (10 digits). Keep the format check but add a new function:
- `validateCRWithWathq(crNumber: string): Promise<{ valid: boolean; status?: string; data?: CRAgentData }>` — calls Wathq to verify the CR exists AND is active. This can be used both in onboarding and in the chat CR agent.

### 5. Update CR Agent (Hybrid Approach)

Modify `src/lib/agents/cr-agent.ts`:
- Add Wathq as the FIRST data source (before QR code extraction)
- The agent should try Wathq first. If it returns data, use it as the primary source with `source: 'wathq_api'` and `confidence: 1.0`
- If Wathq fails (API down, CR not found), fall back to the existing QR code + OCR approach
- If BOTH sources return data (user uploaded a doc AND we got Wathq data), cross-reference them and flag mismatches. Store the Wathq data as authoritative.
- Add `'wathq_api'` to the `CRAgentResult.source` union type

### 6. CR Status Monitoring (Bonus)

Create `src/lib/wathq/cr-monitor.ts`:
- A function that checks CR status for all businesses in the database
- Intended to be called by a cron job (can integrate with existing notification cron at `src/app/api/notifications/send/route.ts`)
- If a CR status changes (e.g., expired, suspended), emit an alert
- If CR expiry date from Wathq differs from what we have stored, update it
- This turns Mugdm from "we remind you about your CR" to "we KNOW your CR status in real-time"

### 7. Migration

Create `supabase/migrations/004_wathq_integration.sql`:
- Add column `wathq_last_checked_at TIMESTAMPTZ` to businesses table
- Add column `wathq_cr_status TEXT` to businesses table
- Add column `cr_source TEXT DEFAULT 'manual'` to businesses table with CHECK constraint: ('manual', 'wathq_api', 'document_ocr', 'qr_webpage')

## Key Constraints

- NEVER expose the Wathq API key to the client — all Wathq calls go through our API route
- The Wathq integration should be graceful-degradation: if the API is down, everything still works via the existing upload flow
- Keep the existing onboarding flow working exactly as-is as a fallback
- All new UI must support both EN and AR locales (add translation keys to the messages files)
- Add the `WATHQ_API_KEY` env var to any .env.example or .env.local.example files
- Run `npx tsc --noEmit` after implementation to verify types
- Run `npx vitest run` to make sure existing tests pass
```
