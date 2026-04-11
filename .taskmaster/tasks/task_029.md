# Task ID: 29

**Title:** Build Manual Transaction Entry and Transaction List

**Status:** pending

**Dependencies:** 2, 6, 7

**Priority:** medium

**Description:** Create manual transaction entry form and the main transaction list view at /app/bookkeeper with filtering, sorting, and pagination.

**Details:**

Add to /app/bookkeeper:

Manual entry form ('Add Transaction' button):
- Fields: date (required), amount (required), type (income/expense toggle), category (dropdown from PRD enum), description, vendor/client name
- Quick entry: only date, amount, type required
- Save: create transaction with source=MANUAL, is_reviewed=true

Transaction list:
- Table/card view of all reviewed transactions
- Columns: date, description, vendor/client, category, amount (green for income, red for expense), source icon
- Filter: by type (income/expense), category (multi-select), source (bank statement/receipt/manual), date range
- Sort: by date, amount, category
- Pagination: 25 per page
- Search: by description or vendor name

Bilingual. SAR currency formatting (Arabic-Indic numerals in Arabic mode).

**Test Strategy:**

Add a manual transaction. Verify it appears in list. Filter by income only. Sort by amount. Verify SAR formatting in both language modes.
