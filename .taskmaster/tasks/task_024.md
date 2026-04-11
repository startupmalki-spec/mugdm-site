# Task ID: 24

**Title:** Build Bank Statement Upload Flow UI

**Status:** pending

**Dependencies:** 4, 6, 7

**Priority:** high

**Description:** Create /app/bookkeeper/upload page for uploading bank statements (CSV or PDF) with bank selection, file upload, and processing progress.

**Details:**

Create /app/bookkeeper/upload/page.tsx:
- Step 1: Select file type (CSV or PDF)
- Step 2: File upload (reuse FileUpload component, max 25MB)
- Step 3: Processing state — show 'Analyzing your bank statement...' with progress
  - For PDF: show per-page progress (Page 1/5 processed...)
- Step 4: Review screen — shows extracted transactions in a table (task 27/28 provides data)
- Bank name detection or manual selection from list of 12+ Saudi banks
- Store upload record in bank_statement_uploads table with status=PROCESSING
- On completion: status→REVIEW_PENDING, redirect to review queue
- On failure: status→FAILED, show error with retry option

Bilingual. Mobile-responsive.

**Test Strategy:**

Upload a CSV file. Verify processing state shows. Upload a PDF. Verify per-page progress. Verify bank_statement_uploads record created with correct status.
