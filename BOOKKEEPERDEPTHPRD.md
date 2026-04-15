# Bookkeeper Depth — v1 PRD
## Accounts Payable (Bills & Payments)

**Status:** Draft
**Author:** Moe (via Claude agent)
**Date:** April 14, 2026
**Target release:** v1 depth push for Bookkeeper module
**Competitive reference:** Kamino (Brazil), Every.io (US)

---

## Problem Statement

Mugdm's Bookkeeper module today is **read-only**. It shows Money In / Money Out / Net Position as aggregate cards, an Expense Breakdown pie, and a Monthly Trend chart. Users can manually add a transaction or upload a receipt, but there is no workflow for how money actually moves in an SME: **bills arrive, someone approves them, someone pays them, and the payment gets reconciled to the books**.

Saudi SME operators — our target user — currently manage Accounts Payable in WhatsApp, Excel, and the bank portal. They miss due dates, pay the same vendor twice, lose invoices, and have no audit trail when ZATCA asks for documentation. Mugdm markets itself as "your business's second brain" but cannot yet replace the AP spreadsheet.

**Cost of not solving:** Users treat Mugdm Bookkeeper as a dashboard, not a system of record. They keep operating AP elsewhere, which means churn risk, no retention hook, and no data moat for the AI Advisor or Chat AI to work with.

---

## Goals

1. **Make Bookkeeper operational.** A user can receive a bill, approve it, record the payment, and attach a ZATCA-compliant receipt — all without leaving Mugdm.
2. **Build the AP data model that v2 (bank connections) will plug into.** Bills and payments need to be first-class entities so that when SAMA Open Banking connects, reconciliation is automatic.
3. **Reduce manual transaction entry by 60%.** Most "transactions" in SME books are bill payments. If the bill → payment flow captures them, users stop manually adding transactions.
4. **Create a compliance artifact.** Every payment produces a traceable audit record (bill → approver → payment date → receipt) that ZATCA / auditors / investors can inspect.
5. **Hook the Compliance Calendar.** When a VAT bill or GOSI payment is due, the Calendar obligation links directly to the bill in Bookkeeper.

---

## Non-Goals (v1)

1. **Bank account connections.** SAMA Open Banking integration is v2. v1 payment recording is manual ("I paid this bill on X date via bank transfer"). Rationale: Open Banking in KSA is still emerging and we want to ship the workflow layer first.
2. **Initiating payments.** We do not send PIX / SARIE / wire transfers from inside Mugdm. Users still pay through their bank. Rationale: regulatory complexity (PSP license), focus on record-keeping first.
3. **Corporate card issuance.** Kamino and Every.io both issue cards. That is a financial services move requiring banking partnerships. Out of scope.
4. **Vendor 1099-equivalent tax filing.** We capture vendor tax info but do not generate year-end forms. Saudi vendor tax treatment is different from US anyway.
5. **Multi-entity / multi-CR consolidation.** Single-business only in v1. Multi-CR is v3.
6. **Approval hierarchy with role-based spending limits.** Single-approver in v1 (anyone with "admin" role can approve). Hierarchy is v3.
7. **Recurring bills automation.** Users can manually duplicate a bill in v1. Automated recurrence is v2.

---

## User Stories

### Primary persona: Small business owner / operator (the ICP)

1. **As an owner**, I want to **add a bill I just received from a vendor** so that I have one place to see everything I owe. The bill has: vendor, amount, VAT (15%), due date, reference number, attached PDF/image.

2. **As an owner**, I want to **upload a vendor invoice (PDF or image) and have Mugdm auto-extract vendor + amount + VAT + due date** so that I do not re-type information. (OCR pipeline already exists via `/api/analyze-receipt` — extend to bills.)

3. **As an owner**, I want to **see a list of all open bills sorted by due date** with clear status (Draft / Pending Approval / Approved / Paid / Overdue) so that I know what is coming up and what is late.

4. **As an owner**, I want to **mark a bill as paid** by entering the payment date, method (bank transfer, cash, card, check), and reference (transaction ID or check number) so that the bill is retired and the expense lands in the books.

5. **As an owner**, I want to **attach the payment confirmation** (screenshot from bank app, bank statement line) to the bill so that audit trail is complete.

6. **As an owner**, I want to **see total outstanding AP** on my Dashboard and Bookkeeper summary so that I know my real near-term cash obligation.

7. **As an owner**, I want to **filter bills by vendor, status, date range, and amount** so that I can find the one I need.

### Secondary persona: Bookkeeper / accountant (the power user)

8. **As a bookkeeper**, I want to **bulk-upload multiple bills at once** (drag several PDFs) so that I can clear the invoice inbox quickly.

9. **As a bookkeeper**, I want to **split a single bill across multiple expense categories** (e.g., half marketing, half software) so that P&L is accurate.

10. **As a bookkeeper**, I want to **categorize a bill with a suggested category based on vendor history** so that I do not think about it every time. (AI-powered via Claude API.)

11. **As a bookkeeper**, I want to **flag a bill as "disputed"** so that it stays in the system but is excluded from AP totals.

### Edge cases

12. **As a user**, I want to **edit a bill after it is approved but before it is paid** so that I can fix typos or correct the amount.
13. **As a user**, I want to **void a bill that was approved in error** with a note for audit trail.
14. **As a user**, I want to **see overdue bills highlighted in red** so that I can act on them first.
15. **As a user**, I want to **be reminded 3 days before a bill is due** via email or in-app notification.

### Internal integration stories

16. **As the system**, I want **every paid bill to automatically create a "Money Out" transaction** in the existing transactions table so that cash flow charts stay accurate.
17. **As the system**, I want **VAT captured on each bill to flow into the quarterly VAT obligation** in the Compliance Calendar so that ZATCA filings pull real data.
18. **As the Chat AI**, I want **bill data queryable** so that users can ask "how much do I owe this month?" and get an answer.

---

## Requirements

### P0 — Must Have (v1 ships without these = feature is not viable)

**Data model:**
- [ ] `bills` table with: id, business_id, vendor_id, bill_number, issue_date, due_date, subtotal, vat_amount, vat_rate, total, currency (default SAR), status (draft/pending/approved/paid/overdue/void), notes, created_at, updated_at
- [ ] `bill_line_items` table with: id, bill_id, description, quantity, unit_price, amount, category_id, cost_center (nullable)
- [ ] `bill_attachments` table with: id, bill_id, storage_key, filename, mime_type, uploaded_by, uploaded_at
- [ ] `bill_payments` table with: id, bill_id, paid_at, amount, method (bank_transfer/cash/card/check/other), reference_number, confirmation_attachment_key (nullable), notes
- [ ] `vendors` table with: id, business_id, name (AR/EN), vat_number (nullable), iban (nullable), email (nullable), phone (nullable), default_category_id, notes, created_at
- [ ] Row-level security (RLS): users can only see bills for their own business
- [ ] Audit log: every state change on a bill writes to `bill_audit_log`

**UI — Bills list:**
- [ ] New `/bookkeeper/bills` route in the app
- [ ] Tab added to existing Bookkeeper page (or new sidebar item "Bills")
- [ ] Table columns: Vendor, Bill #, Issue Date, Due Date, Amount (SAR), VAT, Status, Actions
- [ ] Default sort: due date ascending, overdue first
- [ ] Filters: vendor dropdown, status multi-select, date range, amount range
- [ ] Search: by vendor name or bill number
- [ ] Empty state: "No bills yet — add your first bill" CTA
- [ ] Arabic RTL support throughout

**UI — Add Bill flow:**
- [ ] Two entry paths: (a) Upload PDF/image → OCR extract → user confirms, (b) Manual entry form
- [ ] Form fields: vendor (autocomplete from existing vendors, "add new" inline), bill number, issue date, due date, line items (add/remove rows), VAT rate (default 15%), notes, attachments
- [ ] Auto-calculate subtotal, VAT, total from line items
- [ ] Validation: total must be > 0, due date must be ≥ issue date, vendor required, at least one line item
- [ ] Save as Draft OR Save and Submit for Approval buttons

**UI — Bill detail page:**
- [ ] Shows all bill info, line items, attachments, payment history, audit log
- [ ] Action buttons vary by status: Approve, Mark as Paid, Edit, Void
- [ ] Payment modal: date, method, reference, optional confirmation upload
- [ ] Attachment viewer (PDF/image preview)

**OCR extraction:**
- [ ] Reuse existing `/api/analyze-receipt` pattern, extend for bills
- [ ] Extract: vendor name, VAT number, bill number, issue date, due date, line items, subtotal, VAT amount, total
- [ ] Confidence score per field; flag low-confidence fields for user review
- [ ] Support Arabic and English vendor invoices
- [ ] Support common SA formats (Saudi Electricity, STC, Zain, common commercial invoices)

**Approval workflow:**
- [ ] Bill created in Draft by any user
- [ ] Submitted for approval → status = Pending
- [ ] Admin role user can Approve → status = Approved
- [ ] Admin or Owner can Mark as Paid → status = Paid (payment details captured)
- [ ] Email notification on: submitted, approved, paid (to owner)
- [ ] In-app notification bell update

**Integration — existing transactions:**
- [ ] On "Mark as Paid", auto-create a Money Out transaction with: amount, date, vendor, category (from bill line items), reference to bill_id
- [ ] Bookkeeper summary cards update to include AP totals: "Outstanding AP: X SAR" card added

**Integration — Compliance Calendar:**
- [ ] VAT captured on bills aggregates into the next quarterly VAT obligation
- [ ] GOSI payroll bills (tagged) link to monthly GOSI obligation
- [ ] Obligation detail page shows linked bills

**Integration — Chat AI:**
- [ ] Extend Chat AI tool catalog with: `list_bills`, `get_bill_by_id`, `sum_ap_outstanding`, `bills_due_this_week`
- [ ] Test queries: "how much do I owe this month?", "which vendors am I late paying?", "show me all Zain bills this year"

**Overdue detection:**
- [ ] Daily cron job at 00:00 Riyadh time: move bills past due date from Approved → Overdue
- [ ] Dashboard widget: "Overdue bills (N)" with link

**Permissions:**
- [ ] Add bill: any team member with Bookkeeper access
- [ ] Approve bill: admin or owner only
- [ ] Mark as paid: admin or owner only
- [ ] Void bill: owner only
- [ ] View bills: any team member with Bookkeeper access

### P1 — Should Have (fast follow, 2-4 weeks post-P0)

- [ ] Bulk upload: drag multiple files, OCR all, present for review
- [ ] Duplicate a bill (for recurring-like workflow)
- [ ] Bill templates (common vendors auto-populate category, VAT, etc.)
- [ ] Email-to-bill: forward invoices to `bills@[business-slug].mugdm.com` and auto-create
- [ ] WhatsApp inbox: forward vendor WhatsApp invoices as image → auto-extract
- [ ] Vendor analytics: spend by vendor chart, top-5 vendors by spend
- [ ] Export bills as Excel (reuse existing export infra)
- [ ] "Pending my approval" inbox view for admins
- [ ] Split bill across multiple categories (P0 data model supports it; P1 adds UI)

### P2 — Future Considerations (design-in-mind but not built)

- Recurring bills automation (monthly rent, annual insurance)
- Multi-approval hierarchy with spending thresholds
- Bank connection + auto-match payment to bill (v2 bank depth push)
- Initiating payments from inside Mugdm (v3+ financial services move)
- Multi-entity consolidation (v3 multi-CR push)
- Vendor portal: vendors upload their own invoices into your Mugdm
- Bill aging report (30/60/90+ days outstanding)
- Cash flow forecast integrating bills

---

## Success Metrics

### Leading indicators (measure at 30 days post-launch)

| Metric | Target | Stretch | Measurement |
|---|---|---|---|
| % of active users who add ≥1 bill | 40% | 60% | `COUNT DISTINCT business_id WHERE bills_count > 0` / active users |
| Avg bills added per active business per week | 2 | 5 | `bills created / active businesses / weeks` |
| % bills added via OCR (vs. manual) | 50% | 75% | source_type field |
| OCR field accuracy (vendor/amount/date) | 85% | 95% | post-submit edits tracked |
| Time from bill upload → approved | < 24 hours median | < 2 hours | audit log timestamps |
| % paid bills with attached payment confirmation | 60% | 80% | confirmation_attachment_key not null |

### Lagging indicators (measure at 90 days)

| Metric | Target | Stretch | Measurement |
|---|---|---|---|
| Manual transactions per week per active business | Down 60% from baseline | Down 80% | compare to pre-launch |
| Compliance Calendar obligations resolved on-time | Up 25% | Up 50% | existing obligation completion rate |
| Retention (active users in month N+1 vs. month N) | Up 15 percentage points | Up 30 pp | standard retention cohorts |
| Chat AI query volume about financials | 3x baseline | 5x | `/api/chat` logs with financial intent |
| NPS change (specific question: "Mugdm is my source of truth for business finances") | +20 pts | +40 pts | in-app survey |

---

## Open Questions

| # | Question | Owner | Blocking? |
|---|---|---|---|
| 1 | Do we use our existing Supabase schema or introduce a separate accounting-oriented schema? | Engineering | Blocking — need before data model work |
| 2 | What is the OCR provider strategy — Claude Vision via Anthropic API, or a specialized invoice OCR like Mindee? | Engineering / Moe | Blocking — affects cost model |
| 3 | Do we treat VAT as its own first-class entity (linked to bills) or just a field on the bill? Affects how Compliance Calendar pulls VAT data | Engineering / Compliance | Blocking |
| 4 | Saudi Arabia has suppliers using ZATCA e-invoices (XML). Do we parse those natively in v1, or only PDFs? | Engineering | Non-blocking (can do PDF v1, XML v1.1) |
| 5 | Email-to-bill (P1) requires email ingestion infra. Do we use a service (Postmark, Mailgun) or build it? | Engineering | Non-blocking (P1) |
| 6 | What is the correct Arabic terminology for "Bill" vs "Invoice" vs "Receipt"? Need to align with Saudi accounting standards | Content / Compliance | Blocking for copy |
| 7 | Do overdue bills auto-email the user, or just show in-app? | Product / Moe | Non-blocking, default in-app |
| 8 | Audit log retention — 1 year, 7 years, forever? | Legal / Compliance | Non-blocking, default 7 years (ZATCA requirement) |

---

## Timeline Considerations

**Dependencies:**
- Existing `/api/analyze-receipt` must be extended to `/api/analyze-bill` (higher complexity — multi-line-item extraction)
- Compliance Calendar obligation generator needs extension to pull VAT from bills
- Dashboard widget infrastructure exists; adding AP card is low-effort
- Chat AI tool catalog needs extension

**Suggested phasing inside v1:**

Week 1–2: Data model + migrations, Row-Level Security, seed vendor list
Week 3–4: Bills list UI + Add Bill form (manual entry first)
Week 5: OCR integration + confirmation flow
Week 6: Approval workflow + permissions
Week 7: Payment recording + transaction integration
Week 8: Compliance Calendar + Chat AI + Dashboard integrations, QA, Arabic RTL polish

**Hard deadlines:** None external. Recommend shipping behind a feature flag and dogfooding with 5–10 friendly users first.

---

## Architectural Considerations (for Engineering pairing)

**Data model insurance for v2/v3:**
- Bills should have a nullable `bank_transaction_id` field from day 1, even though bank connections aren't live. Populated by the v2 reconciliation engine.
- `business_id` on every table (not just `user_id`) — this is the foundation for v3 multi-entity. Never hardcode single-business.
- Approval workflow should use a `workflow_state` column with a state-machine library (XState or a simple enum). Makes v3 multi-step approval a config change, not a rewrite.
- Bills are immutable after approval (except for voiding) — any "edit" creates a new version. Standard accounting practice, also what audits require.

**What NOT to build in v1:**
- Do not build a custom file storage layer — use existing Supabase storage
- Do not build a separate permissions system — extend existing RBAC
- Do not write a custom OCR pipeline — integrate a provider, even if crappy
- Do not build a custom notification system — use existing email + in-app stack

---

## Appendix: Competitive positioning notes

**Kamino (Brazil):** Full AP loop including bank account ownership. v1 Mugdm covers the software layer without banking — parity on workflow, gap on payment execution. Fine for v1, necessary to close by v3 to be truly competitive.

**Every.io (US):** Offers dedicated bookkeeper humans. Our angle: AI-assisted + eventual managed-service layer, but not in v1.

**QuickBooks (global):** The default for SMEs. Our wedge is Saudi-native (Arabic, Hijri, ZATCA, GOSI) + AI-first workflow. QuickBooks has AP but not integrated with local compliance out of the box.

**Zoho Books:** Popular in Saudi. Has AP. Our wedge: better UX, AI-first Chat, ZATCA-native from day 1, Arabic-first (not retrofitted).

---

## Next steps after this PRD is approved

1. Engineering kickoff: data model review + schema PR
2. Design: 4 key screens (bills list, add bill, bill detail, payment modal)
3. Content: Arabic/English terminology alignment with accounting standards
4. Set up feature flag
5. Recruit 5 beta businesses for week-8 dogfood
6. Draft BOOKKEEPER-DEPTH-v2-PRD.md for bank connections (starts after v1 week 4)
