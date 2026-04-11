# Task ID: 17

**Title:** Build Compliance Rules Engine (Auto-Generate Obligations)

**Status:** pending

**Dependencies:** 2, 12

**Priority:** high

**Description:** When a business profile is created during onboarding, auto-generate compliance obligations based on CR data: CR confirmation, Chamber renewal, GOSI monthly, ZATCA VAT quarterly, Zakat annual.

**Details:**

Create src/lib/compliance/rules-engine.ts:

Auto-generate on business creation:
1. CR_CONFIRMATION: annual, anniversary of cr_issuance_date. Frequency=ANNUAL.
2. CHAMBER: annual, same date as CR confirmation. Frequency=ANNUAL.
3. GOSI: monthly, due 15th of each month. Generate rolling 12-month entries. Frequency=MONTHLY.
4. ZATCA_VAT: quarterly, due 25th of month after quarter end (Apr 25, Jul 25, Oct 25, Jan 25). Calculate next upcoming. Frequency=QUARTERLY.
5. ZAKAT: annual, 120 days after fiscal_year_end (default Dec 31 → April 30). Frequency=ANNUAL.

If CR is expired (cr_expiry_date < today), create an immediate overdue CR obligation.
If business data indicates foreign ownership (check owners nationalities), add MISA obligation.

Call this function after business record is created in onboarding task 12.

**Test Strategy:**

Create a business with cr_issuance_date=2025-06-15. Verify CR_CONFIRMATION due 2026-06-15. Verify GOSI generates 12 monthly entries. Verify ZATCA next quarterly date is correct. Create business with expired CR, verify overdue obligation.
