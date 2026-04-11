# Task ID: 32

**Title:** Build VAT Estimation Card

**Status:** pending

**Dependencies:** 30

**Priority:** low

**Description:** Calculate and display estimated VAT liability based on categorized transactions. Shows output VAT on income minus input VAT on deductible expenses at 15%.

**Details:**

Add VAT estimation card to financial dashboard:
- Output VAT: (REVENUE + OTHER_INCOME) × 15%
- Input VAT: (SUPPLIES + PROFESSIONAL + MARKETING + RENT + UTILITIES + TRANSPORT + INSURANCE) × 15%
- Net VAT liability: output - input
- Excluded categories: GOVERNMENT, SALARY, BANK_FEES (not VAT-eligible)
- Display: 'Estimated VAT liability this quarter: SAR X,XXX'
- Prominent disclaimer: 'This is an estimate based on categorized transactions. Consult your accountant for exact VAT filing.'
- Updates as new transactions are added
- Period aligned to ZATCA quarters

Bilingual. SAR formatting.

**Test Strategy:**

With sample income and expense transactions, verify VAT calculation is correct at 15%. Verify non-VAT categories are excluded. Verify disclaimer is visible.
