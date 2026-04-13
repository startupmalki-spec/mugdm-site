# PRD: ZATCA E-Invoicing (Fatoora) Integration

> **Author:** Moe (mmalki@tamcapital.sa)
> **Date:** 2026-04-13
> **Status:** Draft
> **Priority:** P0
> **Deadline:** June 30, 2026 (ZATCA Wave 24 enforcement)
> **Depends on:** Bookkeeper module (transactions), Document vault (storage)

---

## 1. Problem Statement

Every VAT-registered business in Saudi Arabia with annual revenue exceeding SAR 375,000 must submit electronic invoices to ZATCA's Fatoora platform by June 30, 2026 (Wave 24). Failure to comply results in fines starting at SAR 5,000 per violation, escalating to SAR 50,000 for repeated offenses.

Mugdm's target users — micro-SMEs — are caught in the worst position: too small to afford an enterprise ERP with built-in ZATCA integration, but too large (above the SAR 375K threshold) to ignore the mandate. Today they either pay SAR 150-300/month for a separate invoicing tool (Wafeq, Qoyod, Qeemah) that doesn't integrate with their compliance or bookkeeping workflow, or they manually generate invoices and upload XML files to the Fatoora portal — a process most business owners don't understand.

Mugdm already has the transaction data, business profile, and VAT calculations. The invoicing layer is the missing piece that turns Mugdm from "tracks your business" to "runs your business."

---

## 2. Goals

1. **Enable Mugdm users to create, submit, and track ZATCA-compliant e-invoices** without leaving the platform — eliminating the need for a separate invoicing tool
2. **Support both B2B (standard/clearance) and B2C (simplified/reporting)** invoice flows, covering 100% of user invoicing scenarios
3. **Allow import of externally-created invoices** for ZATCA submission — users already invoicing elsewhere can still use Mugdm for compliance
4. **Achieve ZATCA compliance before Wave 24 deadline** (June 30, 2026) so users have time to onboard and test
5. **Reduce user invoicing cost** from SAR 150-300/month (external tools) to included in Mugdm subscription

---

## 3. Non-Goals

1. **Full double-entry accounting system** — Mugdm is not replacing Wafeq/Qoyod's general ledger. We handle invoicing and bookkeeping, not chart of accounts management. Separate initiative if needed.
2. **POS (Point of Sale) integration** — Retail businesses using physical POS terminals are not our v1 target. The invoicing module serves businesses that invoice manually or digitally, not cashier-based workflows. Future consideration.
3. **Multi-currency invoicing** — v1 supports SAR only. Cross-border invoicing adds complexity (customs, withholding tax) that doesn't serve micro-SMEs. Revisit when user demand materializes.
4. **Invoice payment collection** — Mugdm will generate and submit invoices but will NOT process payments in v1. Payment links (Moyasar, SADAD) are a Phase 2 feature. Requires separate licensing considerations.
5. **Automated invoice generation from recurring transactions** — Auto-generating invoices from recurring expenses detected by the bookkeeper is powerful but premature. The user must explicitly create each invoice in v1 to build trust in the system.

---

## 4. User Stories

### Persona: Business Owner (صاحب المنشأة)

**Creating invoices:**

- As a business owner, I want to create an invoice by selecting a customer and adding line items so that I can bill my clients without using a separate tool
- As a business owner, I want to create an invoice from an existing transaction in my bookkeeper so that I don't have to re-enter data I've already recorded
- As a business owner, I want Mugdm to auto-fill my business details (name, VAT number, address) from my profile so that every invoice is accurate without manual entry
- As a business owner, I want to preview the invoice before submitting to ZATCA so that I can catch mistakes before they become permanent
- As a business owner, I want to save invoice drafts so that I can come back and finish them later

**ZATCA submission:**

- As a business owner, I want Mugdm to submit my B2B invoice to ZATCA for clearance and tell me if it was accepted or rejected so that I know my invoice is legally valid before sending it to my customer
- As a business owner, I want Mugdm to report my B2C invoices to ZATCA within 24 hours automatically after I confirm them so that I don't have to remember to do it myself
- As a business owner, I want to see a clear status for each invoice (draft → submitted → cleared/reported → rejected) so that I know exactly where things stand
- As a business owner, I want to receive a notification if ZATCA rejects my invoice with a clear explanation of what's wrong so that I can fix and resubmit it

**Importing external invoices:**

- As a business owner who already uses another invoicing tool, I want to upload my invoice XML and have Mugdm submit it to ZATCA so that I can consolidate my compliance in one place
- As a business owner, I want Mugdm to validate my uploaded XML before submitting to ZATCA so that I don't waste a submission on a broken file

**Managing invoices:**

- As a business owner, I want to view all my invoices in a list with filters (date, status, customer, type) so that I can find any invoice quickly
- As a business owner, I want to download a PDF copy of any invoice with the ZATCA QR code so that I can share it with my customer or print it for records
- As a business owner, I want to issue a credit note for a previously cleared invoice so that I can handle refunds and corrections compliantly
- As a business owner, I want to see my total invoiced amount and VAT collected in a dashboard so that I know my tax position at a glance

**Bilingual:**

- As a business owner, I want to create invoices in Arabic, English, or both so that my invoices match my customers' language preferences
- As an Arabic-speaking business owner, I want the entire invoicing flow to work in RTL with Arabic numerals so that the experience feels native

### Persona: Mugdm Admin (Internal)

- As an admin, I want to see aggregate ZATCA submission stats (success rate, rejection reasons, submission latency) so that I can monitor system health and identify common user errors

---

## 5. Requirements

### Must-Have (P0)

**5.1 ZATCA Onboarding Flow**

Users must register their EGS (E-invoice Generation Solution) unit with ZATCA before they can submit invoices.

- [ ] Guide users through CSID certificate generation within Mugdm
- [ ] User enters their VAT registration number and ZATCA Fatoora portal OTP
- [ ] Mugdm generates a CSR (Certificate Signing Request) with business details
- [ ] Call ZATCA Compliance CSID API → obtain compliance certificate
- [ ] Run compliance check with test invoices against ZATCA sandbox
- [ ] Call ZATCA Production CSID API → obtain production certificate (valid 1 year)
- [ ] Store certificates securely (encrypted at rest in Supabase vault or env)
- [ ] Track certificate expiry and prompt renewal 30 days before

Acceptance criteria:
- Given a user with a valid VAT number and Fatoora portal OTP
- When they complete the ZATCA onboarding wizard
- Then they receive a production CSID and can submit real invoices

**5.2 Invoice Creation (B2B Standard Tax Invoice)**

- [ ] Invoice form with: customer details (name, VAT number, address), line items (description, quantity, unit price, VAT rate), payment terms, notes
- [ ] Auto-calculate line totals, VAT per line (15%), subtotal, total VAT, grand total
- [ ] Auto-fill seller details from business profile
- [ ] Sequential invoice numbering (configurable prefix, e.g., INV-2026-0001)
- [ ] Generate UBL 2.1 XML with all mandatory ZATCA fields
- [ ] Cryptographic signing with production CSID
- [ ] Generate TLV-encoded QR code (seller name, VAT number, timestamp, VAT total, invoice total, XML hash)
- [ ] Invoice preview screen before submission
- [ ] User clicks "Submit to ZATCA" → call Clearance API → show accepted/rejected status
- [ ] If accepted: store stamped invoice, mark as "cleared", make available for PDF download and customer sharing
- [ ] If rejected: show ZATCA error codes with human-readable Arabic/English explanations, allow edit and resubmit

Acceptance criteria:
- Given a user with a valid production CSID
- When they create a B2B invoice and click Submit to ZATCA
- Then the invoice is sent to ZATCA's clearance endpoint, and the response (cleared or rejected with reason) is shown within 10 seconds

**5.3 Invoice Creation (B2C Simplified Tax Invoice)**

- [ ] Simplified form: line items, totals, QR code (customer details optional for B2C)
- [ ] Same calculation, XML generation, and signing as B2B
- [ ] User confirms the invoice → invoice is issued to customer immediately
- [ ] Mugdm reports the invoice to ZATCA's Reporting API within 24 hours (background job)
- [ ] If reporting fails: retry up to 3 times with exponential backoff, alert user if all retries fail

Acceptance criteria:
- Given a user creates and confirms a B2C simplified invoice
- When 24 hours have not yet passed
- Then Mugdm automatically reports the invoice to ZATCA without further user action

**5.4 Invoice Import (External XML)**

- [ ] Upload endpoint accepting UBL 2.1 XML files
- [ ] Validate XML against ZATCA schema before submission
- [ ] Show validation errors in human-readable form (Arabic/English)
- [ ] If valid: user can review extracted data and click Submit to ZATCA
- [ ] Track imported invoices alongside natively-created ones with a source tag

Acceptance criteria:
- Given a user uploads a valid UBL 2.1 XML file
- When they click Submit to ZATCA
- Then the invoice is submitted using the same clearance/reporting flow as natively-created invoices

**5.5 Credit Notes (Debit/Credit Notes)**

- [ ] Create a credit note linked to a previously cleared invoice
- [ ] Credit note follows same XML generation, signing, and ZATCA submission flow
- [ ] Original invoice reference is embedded in the credit note XML
- [ ] Both B2B (clearance) and B2C (reporting) credit notes supported

Acceptance criteria:
- Given a previously cleared B2B invoice
- When the user creates a credit note for it
- Then the credit note references the original invoice and is submitted to ZATCA for clearance

**5.6 Invoice Management**

- [ ] Invoice list page with columns: number, date, customer, amount, VAT, status, type (B2B/B2C)
- [ ] Filter by: date range, status (draft/submitted/cleared/reported/rejected), type, customer
- [ ] Search by invoice number or customer name
- [ ] PDF generation with ZATCA QR code, bilingual (AR/EN), proper RTL layout
- [ ] Download PDF, share via link, or copy shareable URL
- [ ] Invoice status lifecycle: `draft → pending_clearance → cleared → reported` (B2C) or `draft → pending_clearance → cleared` (B2B) with `rejected` as an error state from any pending stage

**5.7 Data Model**

```sql
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_en TEXT,
    vat_number TEXT,
    cr_number TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'SA',
    phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    
    -- Invoice identity
    invoice_number TEXT NOT NULL,
    invoice_type TEXT NOT NULL CHECK (invoice_type IN ('standard', 'simplified')),
    invoice_subtype TEXT NOT NULL CHECK (invoice_subtype IN ('invoice', 'credit_note', 'debit_note')),
    source TEXT NOT NULL DEFAULT 'mugdm' CHECK (source IN ('mugdm', 'imported_xml')),
    language TEXT NOT NULL DEFAULT 'ar' CHECK (language IN ('ar', 'en', 'both')),
    
    -- Dates
    issue_date DATE NOT NULL,
    supply_date DATE,
    due_date DATE,
    
    -- Amounts (SAR)
    subtotal NUMERIC(12, 2) NOT NULL,
    total_vat NUMERIC(12, 2) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    
    -- ZATCA fields
    zatca_status TEXT NOT NULL DEFAULT 'draft' CHECK (zatca_status IN (
        'draft', 'pending_clearance', 'cleared', 'reported', 'rejected'
    )),
    zatca_uuid UUID, -- ZATCA-assigned invoice UUID
    zatca_hash TEXT, -- cryptographic hash
    zatca_qr_code TEXT, -- TLV-encoded QR data
    zatca_xml TEXT, -- full UBL 2.1 XML (signed)
    zatca_response JSONB, -- raw ZATCA API response
    zatca_submitted_at TIMESTAMPTZ,
    zatca_cleared_at TIMESTAMPTZ,
    zatca_rejection_reason TEXT,
    
    -- Linkage
    linked_invoice_id UUID REFERENCES invoices(id), -- for credit/debit notes
    linked_transaction_id UUID REFERENCES transactions(id), -- from bookkeeper
    
    -- Notes
    notes TEXT,
    payment_terms TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT uq_invoice_number UNIQUE (business_id, invoice_number)
);

CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 3) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) DEFAULT 0,
    vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
    vat_amount NUMERIC(12, 2) NOT NULL,
    line_total NUMERIC(12, 2) NOT NULL, -- (quantity * unit_price) - discount + vat
    
    CONSTRAINT chk_line_quantity CHECK (quantity > 0),
    CONSTRAINT chk_line_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_line_vat_rate CHECK (vat_rate >= 0 AND vat_rate <= 100)
);

CREATE TABLE zatca_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    cert_type TEXT NOT NULL CHECK (cert_type IN ('compliance', 'production')),
    certificate TEXT NOT NULL, -- PEM-encoded certificate
    private_key_encrypted TEXT NOT NULL, -- encrypted private key
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT uq_active_cert UNIQUE (business_id, cert_type, is_active)
);

-- Indexes
CREATE INDEX idx_invoices_business ON invoices(business_id, issue_date DESC);
CREATE INDEX idx_invoices_status ON invoices(business_id, zatca_status);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_type ON invoices(business_id, invoice_type);
CREATE INDEX idx_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX idx_customers_business ON customers(business_id);
CREATE INDEX idx_zatca_certs_business ON zatca_certificates(business_id, is_active);

-- B2C reporting queue (invoices confirmed but not yet reported to ZATCA)
CREATE INDEX idx_invoices_reporting_queue ON invoices(zatca_status, created_at)
    WHERE invoice_type = 'simplified' AND zatca_status = 'cleared';
```

**5.8 ZATCA API Integration**

- [ ] Client library for all ZATCA Fatoora API endpoints:
  - `POST /compliance` — request compliance CSID
  - `POST /compliance/invoices` — compliance check
  - `POST /production/csids` — request/renew production CSID
  - `POST /invoices/clearance` — clear B2B invoice (synchronous)
  - `POST /invoices/reporting` — report B2C invoice (asynchronous)
- [ ] Sandbox environment (`gw-fatoora.zatca.gov.sa`) for testing
- [ ] Production environment switch via env var
- [ ] Proper error handling for all ZATCA error codes with bilingual user messages
- [ ] Request/response logging for debugging and audit trail

**5.9 B2C Reporting Cron**

- [ ] Background job (Supabase Edge Function or cron) that runs every 4 hours
- [ ] Picks up B2C invoices with `zatca_status = 'cleared'` that haven't been reported yet
- [ ] Submits to ZATCA Reporting API
- [ ] Retries failed submissions up to 3 times with exponential backoff
- [ ] Alerts user if reporting fails after all retries

### Nice-to-Have (P1)

**5.10 Invoice Dashboard**

- [ ] Summary cards: total invoiced this month, total VAT collected, pending clearances, rejection rate
- [ ] Monthly invoicing chart (invoiced amount over time)
- [ ] Top customers by invoice amount
- [ ] VAT collected vs. VAT on purchases (from bookkeeper) = net VAT position

**5.11 Customer Management**

- [ ] Customer directory: save customer details for reuse across invoices
- [ ] Wathq integration: look up customer's business details by CR number (same API we already have)
- [ ] Customer VAT number validation against ZATCA
- [ ] Import customers from a CSV

**5.12 Invoice Templates**

- [ ] 2-3 invoice PDF templates (modern, classic, minimal)
- [ ] Business logo and stamp placement on invoice PDF
- [ ] Custom payment terms, notes, and footer text
- [ ] Color scheme matching business branding

**5.13 Recurring Invoices**

- [ ] Create recurring invoice schedules (monthly, quarterly, annual)
- [ ] Auto-generate draft invoices on schedule
- [ ] User reviews and confirms each generated invoice before ZATCA submission

### Future Considerations (P2)

**5.14 Payment Links** — Embed Moyasar/SADAD payment links in invoices so customers can pay directly. Requires payment gateway integration and potentially SAMA considerations.

**5.15 Automated Invoice from Transaction** — When the bookkeeper detects an income transaction that matches an unpaid invoice, auto-reconcile. When a new sale is recorded, suggest creating an invoice.

**5.16 Batch Import** — Upload a CSV/Excel of multiple invoices for bulk ZATCA submission. Useful for businesses migrating from manual processes.

**5.17 E-Invoice Analytics** — Average time to get paid, overdue invoice aging, customer payment patterns, seasonal revenue trends.

**5.18 Multi-Branch Support** — Separate EGS units per branch, each with their own CSID. Relevant for businesses with multiple locations.

---

## 6. Success Metrics

### Leading Indicators (first 30 days)

| Metric | Target | Stretch | Measurement |
|--------|--------|---------|-------------|
| ZATCA onboarding completion rate | 60% of users who start | 80% | `zatca_certificates` table, production cert issued |
| First invoice created within 7 days of onboarding | 40% of onboarded users | 60% | `invoices` table, `created_at` vs cert `issued_at` |
| ZATCA clearance success rate | >90% | >95% | `invoices` where `zatca_status = 'cleared'` / total submitted |
| Invoice creation to ZATCA clearance latency | <15 seconds (B2B) | <8 seconds | `zatca_submitted_at` to `zatca_cleared_at` |
| B2C reporting within 24h compliance rate | 100% | 100% | All B2C invoices reported before 24h deadline |

### Lagging Indicators (60-90 days)

| Metric | Target | Stretch | Measurement |
|--------|--------|---------|-------------|
| Users who cancel separate invoicing tool | 20% | 40% | User survey / churn from Wafeq/Qoyod |
| Invoicing feature as top-2 reason for signup | 30% of new signups | 50% | Onboarding survey |
| Monthly invoices created per active user | 5+ | 15+ | `invoices` table aggregate |
| Support tickets about ZATCA issues | <10% of total tickets | <5% | Support system |
| Invoicing module adoption rate | 50% of active users | 70% | `feature_adoption` table from ML Intelligence PRD |

---

## 7. Technical Architecture

### 7.1 UBL 2.1 XML Generation

Every invoice must be rendered as a UBL 2.1 XML document conforming to ZATCA's schema. The XML includes:

- Invoice metadata (UUID, issue date, invoice type code)
- Seller party (from `businesses` table + VAT number)
- Buyer party (from `customers` table)
- Line items with individual VAT calculations
- Tax totals and subtotals
- Cryptographic signature (XAdES-BES envelope)
- QR code data (TLV-encoded, Base64)

Implementation: build a `generateInvoiceXML(invoice, lineItems, seller, buyer, certificate)` function that outputs valid UBL 2.1. Use a battle-tested XML library (fast-xml-parser or xmlbuilder2) — do not string-concatenate XML.

### 7.2 Cryptographic Signing

ZATCA requires XAdES-BES (XML Advanced Electronic Signatures) envelope signatures:

- Hash the invoice XML (SHA-256)
- Sign the hash with the business's private key (from CSID)
- Embed the signature in the XML document
- Generate the TLV-encoded QR code from the signed data

Implementation: use Node.js `crypto` module for hashing/signing. The CSID private key must be stored encrypted and never exposed to the client.

### 7.3 QR Code Generation

ZATCA QR codes use TLV (Tag-Length-Value) encoding with these fields:

| Tag | Field | Source |
|-----|-------|--------|
| 1 | Seller name | `businesses.name_ar` |
| 2 | VAT registration number | business VAT number |
| 3 | Timestamp | invoice `created_at` in ISO 8601 |
| 4 | Invoice total (with VAT) | `invoices.total_amount` |
| 5 | VAT total | `invoices.total_vat` |
| 6 | XML hash | SHA-256 of signed XML |
| 7 | ECDSA signature | signature bytes |
| 8 | Public key | from certificate |

TLV is Base64-encoded and rendered as a QR code on the PDF.

### 7.4 Environment Configuration

```
# .env.local
ZATCA_ENV=sandbox  # 'sandbox' or 'production'
ZATCA_API_BASE_URL_SANDBOX=https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal
ZATCA_API_BASE_URL_PRODUCTION=https://gw-fatoora.zatca.gov.sa/e-invoicing/core
ZATCA_CERT_ENCRYPTION_KEY=  # for encrypting stored private keys
```

### 7.5 Integration with Existing Modules

| Module | Integration |
|--------|------------|
| **Bookkeeper** | "Create invoice from transaction" button on income transactions. Invoice amount flows back as reconciled income. |
| **Compliance calendar** | ZATCA certificate expiry added as an obligation (auto-generated, 30-day reminder). B2C reporting deadline tracked. |
| **Document vault** | Signed invoice PDFs and XMLs stored in `generated` storage bucket. |
| **AI Chat** | "Create an invoice for [customer] for [amount]" via chat tool use. "What's my VAT position this quarter?" queries invoice + transaction data. |
| **ML Intelligence** | Emit events: `invoice.created`, `invoice.submitted`, `invoice.cleared`, `invoice.rejected`, `invoice.reported` for feature adoption tracking. |

---

## 8. Open Questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Does Mugdm need to register as an EGS provider with ZATCA, or can each user register their own EGS unit? | Legal / ZATCA | **Yes** — determines the onboarding flow |
| 2 | Can we store CSID private keys in Supabase Vault, or do we need a dedicated HSM/KMS? | Engineering | **Yes** — security architecture |
| 3 | What is the ZATCA sandbox rate limit? How many test invoices can we submit per day? | Engineering | No — only affects testing speed |
| 4 | Should we support VAT-exempt line items (0% VAT) for categories like healthcare, education? | Product | No — default to 15%, add exemptions later |
| 5 | Do we need ZATCA certification/approval before going live, or is passing the compliance check sufficient? | Legal / ZATCA | **Yes** — could add weeks to timeline |
| 6 | For imported XML invoices, do we re-sign them with the user's CSID or submit as-is? | Engineering | No — can decide during implementation |

---

## 9. Timeline & Phasing

### Hard Deadline: June 30, 2026 (Wave 24 enforcement)

Working backwards from the deadline:

**Phase 1: Foundation (Weeks 1-3) — April 14 to May 4**

- [ ] ZATCA API client library (all endpoints, sandbox mode)
- [ ] Database migration (customers, invoices, line_items, certificates tables)
- [ ] CSID onboarding wizard (compliance → production certificate)
- [ ] UBL 2.1 XML generator with cryptographic signing
- [ ] QR code TLV generation

**Phase 2: Core Invoicing (Weeks 4-6) — May 5 to May 25**

- [ ] Invoice creation form (B2B standard + B2C simplified)
- [ ] Invoice preview with live QR code
- [ ] "Submit to ZATCA" flow (clearance for B2B, immediate confirmation for B2C)
- [ ] Invoice list page with filters and search
- [ ] PDF generation (bilingual, with QR code, logo, stamp)
- [ ] Credit/debit notes

**Phase 3: Import + Reporting (Weeks 7-8) — May 26 to June 8**

- [ ] XML import and validation
- [ ] B2C background reporting cron (every 4 hours)
- [ ] ZATCA rejection handling with retry and user notification
- [ ] Certificate expiry monitoring and renewal flow
- [ ] "Create invoice from transaction" integration with bookkeeper

**Phase 4: Polish + Testing (Weeks 9-10) — June 9 to June 22**

- [ ] End-to-end testing against ZATCA sandbox
- [ ] Invoice dashboard (P1 items)
- [ ] Customer management
- [ ] Arabic/English/bilingual invoice templates
- [ ] Error message refinement
- [ ] Performance testing (clearance latency)

**Buffer: June 22-30** — One week buffer before deadline for production cutover and user onboarding.

### Dependencies

- **Wathq integration** (in progress) — needed for customer lookup by CR number (P1)
- **ML Intelligence PRD** — event emission for invoice actions
- **AI Optimization PRD** — Haiku for invoice data extraction from imported XMLs

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **ZATCA sandbox behaves differently from production** | Medium | High | Test against sandbox exhaustively. Join Fatoora developer community for known issues. Plan 1-week buffer. |
| **CSID certificate storage security** | Low | Critical | Encrypt private keys at rest. Evaluate Supabase Vault. Never expose keys to client-side code. Audit access logs. |
| **XML generation produces invalid UBL 2.1** | Medium | High | Use ZATCA's published XSD schemas for validation before submission. Automated tests against sample invoices from ZATCA documentation. |
| **Users don't understand ZATCA onboarding (OTP, CSR)** | High | Medium | Provide step-by-step wizard with screenshots. In-app help text in Arabic. Link to ZATCA Fatoora portal at each step. Offer "let us help" chat support. |
| **Clearance API latency causes poor UX** | Low | Medium | Show loading state with progress indicators. Set 30-second timeout. If timeout, poll for status. Don't block the user from doing other things. |
| **ZATCA changes API spec or adds requirements** | Low | High | Pin to specific API version. Monitor ZATCA announcements. Abstract the API client so changes are isolated. |
| **Scope creep delays launch past June 30** | Medium | Critical | P0 requirements are ruthlessly scoped. Invoicing dashboard, templates, and customer management are P1 — they ship after the deadline if needed. The core flow (create → sign → submit → track) is the only must-have. |

---

## Appendix A: ZATCA API Reference

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/compliance` | POST | Request compliance CSID | OTP |
| `/compliance/invoices` | POST | Submit test invoice for compliance check | Compliance CSID |
| `/production/csids` | POST | Request production CSID | Compliance CSID |
| `/production/csids` | PATCH | Renew production CSID | Production CSID |
| `/invoices/clearance` | POST | Clear B2B standard invoice | Production CSID |
| `/invoices/reporting` | POST | Report B2C simplified invoice | Production CSID |

Base URLs:
- Sandbox: `https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal`
- Production: `https://gw-fatoora.zatca.gov.sa/e-invoicing/core`

## Appendix B: Invoice Status Lifecycle

```
                    ┌─────────┐
                    │  draft   │
                    └────┬─────┘
                         │ user clicks "Submit"
                         ▼
               ┌──────────────────┐
               │ pending_clearance │
               └────────┬─────────┘
                        │
              ┌─────────┴──────────┐
              ▼                    ▼
       ┌──────────┐         ┌──────────┐
       │ cleared  │         │ rejected │
       └────┬─────┘         └────┬─────┘
            │                    │ user edits & resubmits
            │                    └──→ (back to draft)
            │
            │ (B2C only: background job)
            ▼
       ┌──────────┐
       │ reported  │
       └──────────┘
```

## Appendix C: Competitive Positioning

| Feature | Mugdm | Wafeq | Qoyod | Qeemah |
|---------|-------|-------|-------|--------|
| ZATCA e-invoicing | ✅ | ✅ | ✅ | ✅ |
| Compliance calendar | ✅ | ❌ | ❌ | ❌ |
| GOSI calculator | ✅ | ❌ | ❌ | ❌ |
| Government API integration (Wathq) | ✅ | ❌ | ❌ | ❌ |
| AI business assistant | ✅ | ❌ | ❌ | ❌ |
| Document vault with expiry tracking | ✅ | ❌ | ❌ | ❌ |
| Bookkeeping + invoicing + compliance | ✅ (unified) | Invoicing only | Invoicing only | Invoicing only |
| Arabic-first AI chat | ✅ | ❌ | ❌ | ❌ |
| Price point | TBD | ~200 SAR/mo | 199 SAR/mo | 199 SAR/mo |
