# Task ID: 28

**Title:** Build Receipt/Invoice Photo Capture and Extraction

**Status:** pending

**Dependencies:** 2, 4, 6

**Priority:** medium

**Description:** Create receipt capture flow: camera on mobile / file picker on desktop, Claude Vision extraction of amount/vendor/date/category/VAT, confirmation screen, transaction creation.

**Details:**

Add 'Add Receipt' button to /app/bookkeeper:
- Opens camera on mobile (input capture='environment'), file picker on desktop
- Accepted: PNG, JPG, JPEG. Max 10MB.
- Upload to receipts storage bucket
- Send to Claude Vision API (src/app/api/extract-receipt/route.ts):
  'Extract from this receipt: amount, vendor name, date, category, VAT amount (if shown). Return as JSON.'
- Confirmation screen: pre-filled fields (all editable)
  - date, amount (required), vendor, category (dropdown), VAT amount, description
- Save: create transaction with source=RECEIPT_PHOTO, receipt_url, is_reviewed=true (manual entry)
- Receipt image linked to transaction record

Bilingual. Works on both Arabic and English receipts.

**Test Strategy:**

Upload a receipt photo. Verify extraction returns amount at minimum. Edit a field, save. Verify transaction created with source=RECEIPT_PHOTO. Verify receipt image accessible from transaction.
