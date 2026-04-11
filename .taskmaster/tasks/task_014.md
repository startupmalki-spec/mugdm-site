# Task ID: 14

**Title:** Build Document Vault UI

**Status:** pending

**Dependencies:** 4, 6, 7, 10

**Priority:** high

**Description:** Create /app/vault page with document upload (drag-drop + camera), document cards with expiry badges, search/filter, archive toggle, and version history.

**Details:**

Create /app/vault/page.tsx:
- Upload button → reuse FileUpload component (max 25MB, PDF/PNG/JPG/JPEG/DOC/DOCX)
- Document grid/list view (toggle)
- Document card: thumbnail/icon, name, type badge, expiry status badge (green >30d, yellow <30d, red expired), upload date, version count
- After upload: AI processes in background (task 15), show 'Processing...' state on card
- AI suggestion: 'We think this is a [GOSI Certificate]. Is that right?' with accept/change
- Expiry date confirmation: show extracted date in Gregorian + Hijri, allow manual edit
- Version detection: if same type already exists as is_current, prompt 'Replace existing [CR]?'
- If yes: old doc archived (is_current=false), new becomes current
- Archive toggle: 'Show archived' reveals old versions
- Search: by document name or type (client-side for <100 docs)
- Filter: by type (multi-select), status (current/archived), expiry (green/yellow/red)
- Sort: by upload date, expiry date, type
- Dashboard summary: '3 current, 1 expiring soon, 1 expired'

**Test Strategy:**

Upload a document. Verify AI categorization prompt appears. Accept suggestion. Upload same type, verify replacement prompt. Check archive toggle. Test search and filters. Verify expiry badges are correct.
