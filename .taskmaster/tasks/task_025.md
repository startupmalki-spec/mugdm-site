# Task ID: 25

**Title:** Build Claude AI CSV Bank Statement Parsing

**Status:** pending

**Dependencies:** 1

**Priority:** high

**Description:** Create API route that sends CSV bank statement content to Claude Text API for parsing. AI identifies column structure and returns normalized transactions regardless of bank format.

**Details:**

Create src/app/api/parse-statement/csv/route.ts:
- Accept: CSV file content (read from Supabase Storage URL)
- Send full CSV to Claude Text API with prompt:
  'Parse this Saudi bank statement CSV. Identify columns (date, description, debit, credit, balance). Return normalized transactions as JSON array: [{date, amount, type(INCOME/EXPENSE), description, category, confidence}]. Detect the bank from the format. Handle Arabic and English text.'
- AI returns: array of transactions + detected bank name + statement period
- Category assignment from PRD enum (REVENUE, GOVERNMENT, SALARY, RENT, etc.) with confidence score
- Duplicate detection: flag transactions where same date + amount + description already exists in DB
- Return structured response for review queue

Must handle all 12+ Saudi bank CSV formats without hardcoded parsers.
Rate limit: 100 AI calls/day per user.

**Test Strategy:**

Send an Al Rajhi CSV format. Verify transactions parsed correctly. Send SNB format. Verify it also works. Check category assignment has reasonable confidence scores.
