# Task ID: 16

**Title:** Build Document-to-Obligation Auto-Linking

**Status:** pending

**Dependencies:** 2, 15

**Priority:** medium

**Description:** When a document with an expiry date is uploaded to the vault, automatically create or update a linked compliance calendar obligation.

**Details:**

After document AI extraction completes (task 15):
- If document has an expiry_date and a recognized type (not OTHER):
  - Check if an obligation of matching type already exists for this business
  - If exists: update next_due_date to match document expiry, link document
  - If not exists: create new obligation with type, name from document type, frequency=ANNUAL, next_due_date=expiry_date, linked_document_id=document.id
- Type mapping: GOSI_CERT→GOSI, CHAMBER→CHAMBER, MISA→MISA, INSURANCE→INSURANCE, BALADY→BALADY
- CR document expiry → update CR_CONFIRMATION obligation

This is server-side logic triggered after AI extraction, not a separate API route.

**Test Strategy:**

Upload a MISA license with expiry date. Verify obligation created with correct due date. Upload an updated MISA license. Verify obligation date updated, not duplicated.
