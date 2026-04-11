-- Mugdm Initial Schema
-- Saudi micro-enterprise management platform

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    cr_number TEXT NOT NULL,
    activity_type TEXT,
    city TEXT,
    capital NUMERIC(15, 2),
    fiscal_year_end TEXT,
    owners JSONB DEFAULT '[]'::jsonb,
    contact_phone TEXT,
    contact_email TEXT,
    contact_address TEXT,
    logo_url TEXT,
    stamp_url TEXT,
    letterhead_config JSONB,
    cr_issuance_date DATE,
    cr_expiry_date DATE,
    data_sharing_consent BOOLEAN NOT NULL DEFAULT false,
    profile_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_businesses_cr_number UNIQUE (cr_number),
    CONSTRAINT uq_businesses_user_id UNIQUE (user_id)
);

CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    nationality TEXT,
    role TEXT,
    iqama_number TEXT,
    start_date DATE,
    salary NUMERIC(10, 2),
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    termination_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_team_members_status CHECK (status IN ('ACTIVE', 'TERMINATED')),
    CONSTRAINT chk_team_members_salary CHECK (salary IS NULL OR salary >= 0)
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    expiry_date DATE,
    is_current BOOLEAN NOT NULL DEFAULT true,
    extracted_data JSONB,
    ai_confidence NUMERIC(3, 2),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ,

    CONSTRAINT chk_documents_type CHECK (type IN (
        'CR', 'GOSI_CERT', 'ZAKAT_CLEARANCE', 'INSURANCE', 'CHAMBER',
        'BALADY', 'MISA', 'LEASE', 'SAUDIZATION_CERT', 'BANK_STATEMENT',
        'TAX_REGISTRATION', 'OTHER'
    )),
    CONSTRAINT chk_documents_ai_confidence CHECK (
        ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)
    ),
    CONSTRAINT chk_documents_file_size CHECK (file_size IS NULL OR file_size > 0)
);

CREATE TABLE obligations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    frequency TEXT NOT NULL,
    next_due_date DATE NOT NULL,
    last_completed_at TIMESTAMPTZ,
    reminder_30d_sent BOOLEAN NOT NULL DEFAULT false,
    reminder_15d_sent BOOLEAN NOT NULL DEFAULT false,
    reminder_7d_sent BOOLEAN NOT NULL DEFAULT false,
    reminder_1d_sent BOOLEAN NOT NULL DEFAULT false,
    linked_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_obligations_type CHECK (type IN (
        'CR_CONFIRMATION', 'GOSI', 'ZATCA_VAT', 'CHAMBER', 'ZAKAT',
        'BALADY', 'MISA', 'INSURANCE', 'QIWA', 'CUSTOM'
    )),
    CONSTRAINT chk_obligations_frequency CHECK (frequency IN (
        'ONE_TIME', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM'
    ))
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    type TEXT NOT NULL,
    category TEXT,
    description TEXT,
    vendor_or_client TEXT,
    source TEXT NOT NULL,
    source_file_id UUID,
    receipt_url TEXT,
    linked_obligation_id UUID REFERENCES obligations(id) ON DELETE SET NULL,
    vat_amount NUMERIC(12, 2),
    ai_confidence NUMERIC(3, 2),
    is_reviewed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_transactions_type CHECK (type IN ('INCOME', 'EXPENSE')),
    CONSTRAINT chk_transactions_category CHECK (category IS NULL OR category IN (
        'REVENUE', 'OTHER_INCOME', 'GOVERNMENT', 'SALARY', 'RENT',
        'UTILITIES', 'SUPPLIES', 'TRANSPORT', 'MARKETING', 'PROFESSIONAL',
        'INSURANCE', 'BANK_FEES', 'OTHER_EXPENSE'
    )),
    CONSTRAINT chk_transactions_source CHECK (source IN (
        'BANK_STATEMENT_CSV', 'BANK_STATEMENT_PDF', 'RECEIPT_PHOTO', 'MANUAL'
    )),
    CONSTRAINT chk_transactions_amount CHECK (amount >= 0),
    CONSTRAINT chk_transactions_vat CHECK (vat_amount IS NULL OR vat_amount >= 0),
    CONSTRAINT chk_transactions_ai_confidence CHECK (
        ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)
    )
);

CREATE TABLE bank_statement_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    period_start DATE,
    period_end DATE,
    transaction_count INTEGER,
    status TEXT NOT NULL DEFAULT 'PROCESSING',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_bank_uploads_file_type CHECK (file_type IN ('CSV', 'PDF')),
    CONSTRAINT chk_bank_uploads_status CHECK (status IN (
        'PROCESSING', 'REVIEW_PENDING', 'COMPLETED', 'FAILED'
    )),
    CONSTRAINT chk_bank_uploads_tx_count CHECK (
        transaction_count IS NULL OR transaction_count >= 0
    )
);

CREATE TABLE generated_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    template_version TEXT,
    data_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_businesses_user_id ON businesses(user_id);

CREATE INDEX idx_team_members_business_id ON team_members(business_id);
CREATE INDEX idx_team_members_status ON team_members(business_id, status);

CREATE INDEX idx_documents_business_id ON documents(business_id);
CREATE INDEX idx_documents_type ON documents(business_id, type);
CREATE INDEX idx_documents_expiry ON documents(expiry_date) WHERE is_current = true;

CREATE INDEX idx_obligations_business_id ON obligations(business_id);
CREATE INDEX idx_obligations_due_date ON obligations(next_due_date);
CREATE INDEX idx_obligations_type ON obligations(business_id, type);

CREATE INDEX idx_transactions_business_id ON transactions(business_id);
CREATE INDEX idx_transactions_date ON transactions(business_id, date);
CREATE INDEX idx_transactions_type ON transactions(business_id, type);
CREATE INDEX idx_transactions_source_file ON transactions(source_file_id);

CREATE INDEX idx_bank_uploads_business_id ON bank_statement_uploads(business_id);
CREATE INDEX idx_bank_uploads_status ON bank_statement_uploads(status);

CREATE INDEX idx_generated_docs_business_id ON generated_documents(business_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_businesses
    BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at_team_members
    BEFORE UPDATE ON team_members
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at_obligations
    BEFORE UPDATE ON obligations
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statement_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;

-- Businesses: owner can CRUD their own row
CREATE POLICY "businesses_select" ON businesses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "businesses_insert" ON businesses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "businesses_update" ON businesses
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "businesses_delete" ON businesses
    FOR DELETE USING (auth.uid() = user_id);

-- Helper: ownership check for child tables
-- All child tables use the same pattern: business_id must belong to the current user.

CREATE POLICY "team_members_select" ON team_members
    FOR SELECT USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "team_members_insert" ON team_members
    FOR INSERT WITH CHECK (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "team_members_update" ON team_members
    FOR UPDATE USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    ) WITH CHECK (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "team_members_delete" ON team_members
    FOR DELETE USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "documents_select" ON documents
    FOR SELECT USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "documents_insert" ON documents
    FOR INSERT WITH CHECK (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "documents_update" ON documents
    FOR UPDATE USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    ) WITH CHECK (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "documents_delete" ON documents
    FOR DELETE USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "obligations_select" ON obligations
    FOR SELECT USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "obligations_insert" ON obligations
    FOR INSERT WITH CHECK (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "obligations_update" ON obligations
    FOR UPDATE USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    ) WITH CHECK (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "obligations_delete" ON obligations
    FOR DELETE USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "transactions_select" ON transactions
    FOR SELECT USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "transactions_insert" ON transactions
    FOR INSERT WITH CHECK (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "transactions_update" ON transactions
    FOR UPDATE USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    ) WITH CHECK (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "transactions_delete" ON transactions
    FOR DELETE USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "bank_uploads_select" ON bank_statement_uploads
    FOR SELECT USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "bank_uploads_insert" ON bank_statement_uploads
    FOR INSERT WITH CHECK (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "bank_uploads_update" ON bank_statement_uploads
    FOR UPDATE USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    ) WITH CHECK (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "bank_uploads_delete" ON bank_statement_uploads
    FOR DELETE USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "generated_docs_select" ON generated_documents
    FOR SELECT USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "generated_docs_insert" ON generated_documents
    FOR INSERT WITH CHECK (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "generated_docs_delete" ON generated_documents
    FOR DELETE USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false);

INSERT INTO storage.buckets (id, name, public)
VALUES ('generated', 'generated', false);

INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', false);

CREATE POLICY "storage_documents_select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM businesses WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "storage_documents_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM businesses WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "storage_documents_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM businesses WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "storage_receipts_select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'receipts'
        AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM businesses WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "storage_receipts_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'receipts'
        AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM businesses WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "storage_receipts_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'receipts'
        AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM businesses WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "storage_generated_select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'generated'
        AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM businesses WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "storage_generated_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'generated'
        AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM businesses WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "storage_logos_select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'logos'
        AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM businesses WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "storage_logos_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'logos'
        AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM businesses WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "storage_logos_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'logos'
        AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM businesses WHERE user_id = auth.uid()
        )
    );
