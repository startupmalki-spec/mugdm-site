# Mugdm AI Intelligence PRD — "The Brain Behind the Second Brain"

## Overview
The AI layer powers Mugdm's intelligence — turning uploaded documents into structured data, raw bank statements into categorized transactions, and compliance deadlines into proactive alerts. This PRD defines how AI should work across every module.

## AI Capabilities

### 1. Document Intelligence
**Current state:** Claude analyzes uploaded images, extracts type/expiry/registration number. Recently enhanced with CR-specific extraction and barcode detection.

**Enhancements needed:**

#### 1.1 Multi-page PDF processing
- Process multi-page PDF documents (contracts, financial reports)
- Extract data from all pages, not just the first
- Handle Arabic-heavy documents with mixed Arabic/English content

#### 1.2 Barcode & QR code following
- When a QR code is detected in a document, attempt to describe the URL
- For Saudi government QR codes (common on official certificates), extract the verification URL
- Store extracted QR data in document metadata for future verification

#### 1.3 Document relationship mapping
- Detect when an uploaded document relates to an existing one (e.g., renewed CR → link to old CR)
- Identify cross-document references (e.g., GOSI certificate references CR number)
- Auto-suggest linking documents to relevant compliance obligations

#### 1.4 Automated compliance detection
- When a new document is uploaded, scan for compliance implications
- Example: uploading a new lease contract → auto-create "Balady license renewal" obligation
- Example: uploading GOSI certificate → verify against team member count

### 2. Financial Intelligence

#### 2.1 Smart receipt/invoice parsing
**Current state:** Just fixed — now sends real data to Claude API with PDF support.

**Enhancements needed:**
- Parse complex Saudi invoices with multiple tax rates
- Handle handwritten receipts (common at small shops)
- Extract VAT registration numbers for supplier verification
- Detect duplicate entries across manual input and receipt scans
- Learn from user corrections — if user re-categorizes, remember for future similar transactions

#### 2.2 Bank statement AI
**Current state:** CSV parsing via Claude works.

**Enhancements needed:**
- PDF bank statement parsing (extract tables from PDF)
- Auto-detect which Saudi bank the statement is from (layout recognition)
- Smart categorization based on Saudi transaction patterns (SADAD = government, Mada = POS, etc.)
- Reconcile statement entries against existing manual/receipt entries

#### 2.3 Financial forecasting
- Predict monthly cash burn based on historical data
- Alert when cash reserves are projected to run low
- Identify seasonal patterns in revenue/expenses
- Suggest cost optimization opportunities

### 3. Compliance Intelligence

#### 3.1 Proactive deadline management
- Generate reminders at configurable intervals (90/60/30/14/7/3/1 days)
- Escalate urgency as deadlines approach (email → SMS → dashboard banner)
- Calculate and display penalty risk amounts

#### 3.2 Regulation awareness
- Understand Saudi business regulations per business type
- When business type changes, suggest new compliance requirements
- Track regulatory changes (future: integrate with government announcement feeds)

#### 3.3 Cross-module intelligence
- Connect documents to obligations (GOSI cert → GOSI payment obligation)
- Connect transactions to obligations (rent payment → lease agreement → Balady license)
- Build a compliance health score based on document validity + obligation status

### 4. Natural Language Interface (Future)

#### 4.1 Ask Mugdm
- "How much did I spend on rent this year?"
- "When does my CR expire?"
- "Show me all documents expiring in the next 30 days"
- "What's my Saudization ratio?"
- Natural language queries against the business data

#### 4.2 Action commands
- "Add a new team member named Ahmed, Saudi, salary 8000"
- "Upload this as an insurance document"
- "Mark GOSI payment as done for this month"

## Technical Requirements
- Claude API (Sonnet for most tasks, Opus for complex analysis)
- Rate limiting: 100 AI calls per business per day (configurable)
- Response caching: cache AI results for identical inputs
- Fallback handling: graceful degradation when AI is unavailable
- Confidence scoring: all AI outputs include confidence score, flag low-confidence results for user review
- Structured output: all AI responses use JSON mode for reliable parsing
