<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:compliance-obligation-rules -->
# Smart Compliance Obligation Generation

## Problem
The obligation generator (`src/lib/compliance/obligation-generator.ts`) currently treats some
obligations as universal when they are conditional. Balady license is the worst offender — it is
generated for every business but only applies to businesses with a physical premises.

## ISIC-Based Obligation Rules

The Wathq API returns structured ISIC activity codes via `main_activity_code` and `sub_activities`
(already parsed in `src/lib/wathq/client.ts` line 212-215, stored in `CRAgentData`). These MUST
be used to determine which obligations apply instead of free-text keyword matching.

### Architecture

1. **Extend `CRData` interface** in `obligation-generator.ts` to include:
   - `isicCode: string | null` — the ISIC main activity code from Wathq
   - `subActivityCodes: string[]` — sub-activity ISIC codes from Wathq
   - `hasPhysicalLocation: boolean | null` — inferred from ISIC or asked during onboarding

2. **Create `src/lib/compliance/isic-rules.ts`** — a mapping from ISIC code prefixes to:
   - Which obligations are REQUIRED (auto-add)
   - Which obligations are NOT_APPLICABLE (never add)
   - Which obligations are SUGGESTED (show to user for confirmation)

3. **ISIC → Obligation mapping** (non-exhaustive, expand as we learn):
   - ISIC 62xx (IT/software), 64xx-66xx (financial services), 69xx (legal/accounting):
     → Balady = NOT_APPLICABLE (typically no physical storefront)
   - ISIC 55xx-56xx (accommodation/food): → FOOD_SAFETY = REQUIRED, BALADY = REQUIRED
   - ISIC 41xx-43xx (construction): → SAFETY_CERT = REQUIRED, BALADY = REQUIRED
   - ISIC 86xx (human health): → HEALTH_LICENSE = REQUIRED, BALADY = REQUIRED
   - ISIC 47xx (retail): → BALADY = REQUIRED

4. **Fallback chain** when generating obligations:
   ```
   Wathq ISIC code available? → Use ISIC rules from isic-rules.ts
   ISIC not available but activityType text exists? → Use keyword matching (current behavior)
   Neither available? → Mark obligation as SUGGESTED, show confirmation step to user
   ```

5. **Onboarding flow** (`src/app/[locale]/(app)/onboarding/page.tsx`):
   - After the compliance calendar is generated, show a **review step** where the user can
     toggle obligations on/off before confirming
   - Any obligation marked SUGGESTED should be visually distinct (e.g., "We think this applies
     — confirm?")
   - If Balady is included but ISIC suggests no physical location, show it as toggled OFF
     by default with a note: "Enable if your business has a physical premises"

### Data Flow (Onboarding)

```
CR Upload/Wathq Lookup
  → CRAgentData { main_activity_code, sub_activities, activity_type, ... }
  → Pass ISIC code + activity text to obligation generator
  → obligation-generator calls isic-rules.ts to classify each obligation type
  → Returns obligations with applicability: REQUIRED | NOT_APPLICABLE | SUGGESTED
  → Onboarding UI shows review step with toggles
  → User confirms → only confirmed obligations are saved to DB
```

### Key Files
- `src/lib/compliance/obligation-generator.ts` — extend CRData, use ISIC rules
- `src/lib/compliance/isic-rules.ts` — NEW: ISIC code → obligation applicability mapping
- `src/lib/wathq/client.ts` — already extracts `mainActivityCode` and `subActivities`
- `src/lib/agents/cr-agent.ts` — already has `main_activity_code` and `sub_activities` in CRAgentData
- `src/app/api/onboarding/route.ts` — pipe ISIC code through to obligation generator
- `src/app/[locale]/(app)/onboarding/page.tsx` — add review/confirm step for obligations

### VAT Filing Frequency
VAT return frequency depends on annual revenue, not just registration:
- Revenue > 40M SAR → Monthly filing
- Revenue ≤ 40M SAR → Quarterly filing
- Revenue < 375K SAR → Not required to register (optional)
Currently hardcoded as QUARTERLY. When revenue data is available (from Wathq `capital` field
as proxy, or user input), adjust the frequency accordingly.
<!-- END:compliance-obligation-rules -->
