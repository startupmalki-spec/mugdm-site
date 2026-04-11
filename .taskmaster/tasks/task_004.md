# Task ID: 4

**Title:** Configure Supabase Storage Buckets

**Status:** pending

**Dependencies:** 2

**Priority:** high

**Description:** Create 4 private storage buckets with RLS policies: business-assets (logos/stamps), vault (documents), receipts (receipt photos), bank-statements (CSV/PDF uploads).

**Details:**

Buckets:
1. business-assets: path /{business_id}/logo/ and /{business_id}/stamp/, max 2MB
2. vault: path /{business_id}/documents/{document_id}/, max 25MB, accepts PDF/PNG/JPG/JPEG/DOC/DOCX
3. receipts: path /{business_id}/receipts/{transaction_id}/, max 10MB
4. bank-statements: path /{business_id}/statements/{upload_id}/, max 25MB

All buckets private. Storage policies mirror RLS: user can only access files under their business_id. Signed URLs with 1-hour expiry for viewing.

**Test Strategy:**

Upload a file to each bucket. Verify signed URL generation works. Verify cross-user access is denied.
