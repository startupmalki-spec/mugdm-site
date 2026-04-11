# Task ID: 11

**Title:** Build Claude Vision CR Extraction API Route

**Status:** pending

**Dependencies:** 1

**Priority:** high

**Description:** Create a Next.js API route that accepts a CR document image/PDF, sends it to Claude Vision API for data extraction (QR decode + field extraction), and returns structured business data.

**Details:**

Create src/app/api/extract-cr/route.ts:
- Accept: file URL from Supabase Storage (signed URL)
- Download file, convert to base64 if image, or extract pages if PDF
- Send to Claude Vision API with prompt to:
  1. Find and decode QR code in CR document
  2. Extract CR number from QR code URL or text
  3. Extract: company name (AR + EN), CR number, activity type, city, capital, owner/partner names and nationalities, issuance date, expiry date
- Return structured JSON with confidence scores per field
- If QR decode fails, extract directly from document text
- If confidence < 0.5 on key fields (CR number, company name), return low_confidence flag

Claude API key stored as environment variable, never exposed to client.
Rate limit: check user hasn't exceeded 100 AI calls/day.

**Test Strategy:**

Send a sample CR document image. Verify structured data is returned. Verify low confidence triggers fallback flag. Verify API key is not in client bundle.
