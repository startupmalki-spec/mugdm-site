# Task ID: 31

**Title:** Build Government Payment Detection and Obligation Linking

**Status:** pending

**Dependencies:** 25, 26, 17

**Priority:** medium

**Description:** AI scans bank statement transactions for government payments (GOSI, ZATCA, municipality fees) and prompts user to link them to compliance calendar obligations.

**Details:**

After bank statement parsing (tasks 25/26), before review queue:
- Send transaction list to Claude Text API (src/app/api/detect-gov-payments/route.ts):
  'Identify Saudi government payments in these transactions: GOSI (recurring ~15th), ZATCA/VAT, municipality fees, Chamber of Commerce. Return matches with suggested obligation type and confidence.'
- For each detected payment, show prompt in review queue:
  'This SAR X,XXX debit on [date] looks like a [GOSI] payment — confirm?'
- If confirmed: link transaction to matching obligation (linked_obligation_id), mark obligation as completed
- If dismissed: treat as normal transaction

This enriches the review queue from task 27 with government payment detection.

**Test Strategy:**

Upload a statement containing a ~15th-of-month recurring debit. Verify AI detects it as potential GOSI. Confirm. Verify obligation linked and marked complete.
