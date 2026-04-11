# Task ID: 26

**Title:** Build Claude AI PDF Bank Statement Parsing

**Status:** pending

**Dependencies:** 1

**Priority:** high

**Description:** Create API route that sends PDF bank statement pages as images to Claude Vision API for transaction extraction. Handles Arabic/English layouts across all Saudi banks.

**Details:**

Create src/app/api/parse-statement/pdf/route.ts:
- Accept: PDF file URL from Supabase Storage
- Convert each PDF page to an image (use pdf-to-img or similar)
- Send each page image to Claude Vision API with prompt:
  'Extract bank transactions from this statement page. Return: [{date, amount, type(INCOME/EXPENSE), description, category, confidence}]. Handle Arabic text, different bank layouts, and tabular data.'
- Aggregate transactions across all pages
- Remove duplicate header rows or summary lines
- Return: transactions array + detected bank + period + page count
- Progress callback: report completion per page for UI updates

Processing may take 10-30 seconds per page.
Rate limit: each page counts as 1 AI call.

**Test Strategy:**

Send a 3-page PDF statement. Verify transactions extracted from all pages. Verify no duplicate headers. Verify per-page progress reporting works.
