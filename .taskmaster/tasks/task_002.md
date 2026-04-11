# Task ID: 2

**Title:** Create Supabase Database Schema

**Status:** pending

**Dependencies:** None

**Priority:** high

**Description:** Create all 7 database tables defined in PRD section 8.1: businesses, team_members, documents, obligations, transactions, bank_statement_uploads, generated_documents. Include all constraints, indexes, and JSONB defaults.

**Details:**

Create a Supabase migration file with:
- businesses: id, user_id (FK auth.users), name_ar, name_en, cr_number (UNIQUE), activity_type, city, capital, fiscal_year_end, owners (JSONB), contact_phone, contact_email, contact_address, logo_url, stamp_url, letterhead_config (JSONB), cr_issuance_date, cr_expiry_date, data_sharing_consent (JSONB), profile_history (JSONB), created_at, updated_at
- team_members: id, business_id (FK), name, nationality, role, iqama_number, start_date, salary, status CHECK ('ACTIVE','TERMINATED'), termination_date, timestamps
- documents: id, business_id (FK), type CHECK enum (CR, GOSI_CERT, ZAKAT_CLEARANCE, INSURANCE, CHAMBER, BALADY, MISA, LEASE, SAUDIZATION_CERT, BANK_STATEMENT, TAX_REGISTRATION, OTHER), name, file_url, file_size, mime_type, expiry_date, is_current, extracted_data (JSONB), ai_confidence, uploaded_at, archived_at
- obligations: id, business_id (FK), type CHECK enum, name, description, frequency CHECK enum, next_due_date, last_completed_at, reminder flags (30d/15d/7d/1d), linked_document_id (FK), notes, timestamps
- transactions: id, business_id (FK), date, amount DECIMAL, type CHECK ('INCOME','EXPENSE'), category, description, vendor_or_client, source CHECK enum, source_file_id, receipt_url, linked_obligation_id (FK), vat_amount, ai_confidence, is_reviewed, created_at
- bank_statement_uploads: id, business_id (FK), bank_name, file_url, file_type CHECK ('CSV','PDF'), period_start, period_end, transaction_count, status CHECK enum, error_message, created_at
- generated_documents: id, business_id (FK), type, subtype, content (JSONB), language, pdf_url, created_at

All indexes from PRD section 8.1.

**Test Strategy:**

Run migration against Supabase. Verify all tables exist with correct columns and constraints. Test inserting sample data.
