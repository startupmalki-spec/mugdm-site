# Mugdm Core Platform PRD — "Every Business Owner's Second Brain"

## Overview
Mugdm is an AI-powered operations platform for Saudi small business owners (1-5 businesses). It replaces the CEO's reliance on Excel, WhatsApp reminders, and scattered documents with a single intelligent hub. Target users are non-tech-savvy Saudi entrepreneurs who manage everything themselves — Mugdm becomes their virtual COO.

## Vision
Move all business operations work currently done on Excel, paper, and WhatsApp into one smart platform that proactively manages deadlines, organizes documents, tracks finances, and manages team compliance.

## Core Modules

### 1. Document Vault
**Current state:** Functional — upload, AI type detection, grid/list view, search/filter, status badges.

**Enhancements needed:**
- **Smart folder organization** — auto-organize by document type (CR, GOSI, Insurance, etc.) into virtual folders
- **Version history** — when a user uploads a renewed CR, link it to the previous version
- **Expiry countdown widgets** — prominent countdown badges ("CR expires in 14 days") on each document card
- **Bulk upload** — drag multiple files at once, AI processes each
- **Document sharing** — generate secure shareable links for accountants/lawyers (time-limited)
- **OCR text search** — search inside document contents, not just metadata
- **Auto-renewal reminders** — push email/notification 90, 60, 30, 14, 7 days before expiry

### 2. Compliance Calendar
**Current state:** Functional — month/list view, create obligations, auto-generated Saudi obligations, Hijri support.

**Enhancements needed:**
- **Smart obligation generation from CR** — when a user uploads their CR, auto-detect business type and generate ALL relevant compliance obligations (GOSI monthly, ZATCA quarterly, CR renewal, Balady license, Chamber membership, etc.)
- **Recurring obligation templates** — Saudi-specific templates: GOSI (monthly by 15th), ZATCA VAT (quarterly), Zakat (annual), etc.
- **Penalty calculator** — show estimated penalty amounts for late compliance (e.g., GOSI late = 2% per month)
- **Integration readiness** — structure obligations so future integrations with Absher, GOSI portal, ZATCA can auto-verify status
- **Task delegation** — assign obligations to team members
- **Completion proof upload** — attach payment receipts or certificates when marking as done

### 3. AI Bookkeeper
**Current state:** Functional — period filters, charts, transaction list, receipt capture (just fixed from mock to real API), bank statement upload.

**Enhancements needed:**
- **Invoice parsing** — properly parse both incoming and outgoing invoices (not just receipts)
- **Recurring expense detection** — identify monthly patterns (rent, utilities, subscriptions) and auto-categorize
- **VAT report generation** — generate quarterly VAT return draft based on categorized transactions
- **Profit & Loss statement** — auto-generate P&L from categorized income/expenses
- **Cash flow forecast** — predict next month's cash position based on recurring patterns
- **Bank reconciliation** — match uploaded bank statements against manual entries
- **Multi-currency support** — handle SAR, USD, EUR for businesses with international transactions
- **Excel import/export** — import from existing Excel bookkeeping, export reports to Excel/PDF
- **Supplier/client directory** — auto-build a contacts directory from transaction data

### 4. Team Management
**Current state:** Functional — add members, Saudization ratio tracker, nationality flags, activate/deactivate.

**Enhancements needed:**
- **GOSI calculation per employee** — auto-calculate GOSI contribution (Saudi: 21.5%, Non-Saudi: 2%)
- **Contract management** — track employment contract dates, renewal reminders
- **Leave tracking** — basic annual/sick leave balance tracker
- **Salary history** — track salary changes over time
- **Saudization planning** — simulate "what if I hire 1 Saudi" scenarios to see ratio impact
- **Employee documents** — attach Iqama copies, contracts, certificates per team member

### 5. Dashboard
**Current state:** Functional — compliance card, document status, financial summary, quick actions.

**Enhancements needed:**
- **AI insights panel** — proactive recommendations like "Your CR expires in 30 days — here's what you need to renew"
- **Weekly digest** — summarize what happened this week (new expenses, upcoming deadlines, team changes)
- **Action items queue** — prioritized list of things the user needs to do TODAY
- **Multi-business switcher** — for users with multiple CRs, switch between businesses
- **Customizable widgets** — let users choose which cards appear on their dashboard

### 6. Settings & Profile
**Current state:** Functional — language, theme, notification preferences.

**Enhancements needed:**
- **Notification channels** — email + SMS + WhatsApp notification options
- **Data export** — full business data export (GDPR-style)
- **Account deletion** — self-service account and data deletion
- **Two-factor authentication** — optional 2FA via authenticator app
- **Audit log** — track all actions taken in the platform

## Technical Requirements
- Bilingual (AR/EN) with full RTL support throughout
- Mobile-first (70%+ mobile users)
- Offline-capable for viewing cached documents
- Sub-2s page load times
- Supabase for auth, database, and storage
- Claude API for all AI features
