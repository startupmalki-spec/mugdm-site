# Task ID: 15

**Title:** Build Document AI Categorization and Expiry Extraction

**Status:** pending

**Dependencies:** 1, 4

**Priority:** high

**Description:** Create API routes for AI-powered document categorization (type detection) and expiry date extraction using Claude Vision/Text API.

**Details:**

Create src/app/api/analyze-document/route.ts:
- Accept: file URL from Supabase Storage
- Send document to Claude Vision API
- Task 1 — Categorize: determine document type from enum (CR, GOSI_CERT, ZAKAT_CLEARANCE, INSURANCE, CHAMBER, BALADY, MISA, LEASE, SAUDIZATION_CERT, BANK_STATEMENT, TAX_REGISTRATION, OTHER). Return type + confidence score.
- Task 2 — Extract expiry: find expiry/renewal date in the document. Return date in ISO format + confidence.
- If confidence < 0.5 for type, return OTHER with low_confidence flag
- If no date found, return null for expiry_date
- Store raw extraction in documents.extracted_data JSONB
- Store confidence in documents.ai_confidence

This runs as a background process after upload. Update document record when complete.
Rate limit: 100 AI calls/day per user.

**Test Strategy:**

Submit a GOSI certificate image. Verify type=GOSI_CERT returned. Submit a document with visible expiry date. Verify date extracted correctly. Submit an ambiguous document. Verify OTHER with low confidence.
