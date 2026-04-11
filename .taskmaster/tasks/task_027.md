# Task ID: 27

**Title:** Build Transaction Review Queue

**Status:** pending

**Dependencies:** 24, 25, 26

**Priority:** high

**Description:** Create the mandatory review interface for bulk-uploaded transactions. Items with AI confidence < 0.7 must be reviewed before appearing in the dashboard.

**Details:**

Create src/components/bookkeeper/ReviewQueue.tsx (used in /app/bookkeeper):
- Table of unreviewed transactions (is_reviewed=false)
- Each row: date, amount, description, AI suggested category, confidence score (color-coded)
- Uncertain items (confidence < 0.7) highlighted and MUST be resolved
- Actions per item: Accept (keep AI suggestion), Change (dropdown to select different category), Split (break into multiple entries)
- Batch actions: 'Accept all confident' (accept items with confidence >= 0.7)
- Queue counter badge in sidebar navigation
- Queue must be empty before transactions appear in financial dashboard
- After all items reviewed: update bank_statement_uploads.status→COMPLETED

Bilingual. Responsive table (cards on mobile).

**Test Strategy:**

Upload a statement with mixed confidence scores. Verify uncertain items are highlighted. Accept one, change one, split one. Verify queue count updates. Verify dashboard shows transactions only after queue is empty.
