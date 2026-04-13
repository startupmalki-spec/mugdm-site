-- ZATCA E-Invoicing module schema.
-- See PRD_ZATCA_EINVOICING.md §5.7 Data Model.
-- Tables: customers, invoices, invoice_line_items, zatca_certificates.

-- =========================================================================
-- customers
-- =========================================================================
CREATE TABLE IF NOT EXISTS customers (
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- invoices
-- =========================================================================
CREATE TABLE IF NOT EXISTS invoices (
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
    zatca_uuid UUID,
    zatca_hash TEXT,
    zatca_qr_code TEXT,
    zatca_xml TEXT,
    zatca_response JSONB,
    zatca_submitted_at TIMESTAMPTZ,
    zatca_cleared_at TIMESTAMPTZ,
    zatca_rejection_reason TEXT,

    -- Linkage
    linked_invoice_id UUID REFERENCES invoices(id),
    linked_transaction_id UUID REFERENCES transactions(id),

    -- Notes
    notes TEXT,
    payment_terms TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_invoice_number UNIQUE (business_id, invoice_number)
);

-- =========================================================================
-- invoice_line_items
-- =========================================================================
CREATE TABLE IF NOT EXISTS invoice_line_items (
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

-- =========================================================================
-- zatca_certificates
-- =========================================================================
CREATE TABLE IF NOT EXISTS zatca_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    cert_type TEXT NOT NULL CHECK (cert_type IN ('compliance', 'production')),
    certificate TEXT NOT NULL,           -- PEM-encoded certificate
    private_key_encrypted TEXT NOT NULL, -- encrypted private key
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_active_cert UNIQUE (business_id, cert_type, is_active)
);

-- =========================================================================
-- Indexes
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_invoices_business ON invoices(business_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(business_id, zatca_status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(business_id, invoice_type);
CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_zatca_certs_business ON zatca_certificates(business_id, is_active);

-- B2C reporting queue (simplified invoices cleared but not yet reported to ZATCA)
CREATE INDEX IF NOT EXISTS idx_invoices_reporting_queue ON invoices(zatca_status, created_at)
    WHERE invoice_type = 'simplified' AND zatca_status = 'cleared';

-- =========================================================================
-- RLS
-- =========================================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE zatca_certificates ENABLE ROW LEVEL SECURITY;

-- customers: owner full access
CREATE POLICY "customers_select_own" ON customers
    FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "customers_insert_own" ON customers
    FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "customers_update_own" ON customers
    FOR UPDATE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()))
              WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "customers_delete_own" ON customers
    FOR DELETE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- invoices: owner full access
CREATE POLICY "invoices_select_own" ON invoices
    FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "invoices_insert_own" ON invoices
    FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "invoices_update_own" ON invoices
    FOR UPDATE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()))
              WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "invoices_delete_own" ON invoices
    FOR DELETE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- invoice_line_items: access through parent invoice
CREATE POLICY "invoice_line_items_select_own" ON invoice_line_items
    FOR SELECT USING (invoice_id IN (
        SELECT id FROM invoices WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ));
CREATE POLICY "invoice_line_items_insert_own" ON invoice_line_items
    FOR INSERT WITH CHECK (invoice_id IN (
        SELECT id FROM invoices WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ));
CREATE POLICY "invoice_line_items_update_own" ON invoice_line_items
    FOR UPDATE USING (invoice_id IN (
        SELECT id FROM invoices WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ))
    WITH CHECK (invoice_id IN (
        SELECT id FROM invoices WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ));
CREATE POLICY "invoice_line_items_delete_own" ON invoice_line_items
    FOR DELETE USING (invoice_id IN (
        SELECT id FROM invoices WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ));

-- zatca_certificates: owner SELECT only; writes via service role
-- (private key material should only be written by trusted server code)
CREATE POLICY "zatca_certificates_select_own" ON zatca_certificates
    FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- Rollback:
--   DROP TABLE IF EXISTS invoice_line_items, invoices, customers, zatca_certificates CASCADE;
