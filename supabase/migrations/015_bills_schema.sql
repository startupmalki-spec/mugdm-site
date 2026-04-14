-- Accounts Payable (Bills) module schema.
-- Tables: vendors, bills, bill_line_items, bill_attachments, bill_payments, bill_audit_log.
-- RLS pattern mirrors migration 011_zatca_invoicing.sql:
--   business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
-- Reuses handle_updated_at() defined in 001_initial_schema.sql.

-- =========================================================================
-- ENUMs
-- =========================================================================
DO $$ BEGIN
    CREATE TYPE bill_status AS ENUM ('draft', 'pending', 'approved', 'paid', 'overdue', 'void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('bank_transfer', 'cash', 'card', 'check', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- vendors
-- =========================================================================
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name_ar TEXT,
    name_en TEXT,
    vat_number TEXT,
    iban TEXT,
    email TEXT,
    phone TEXT,
    default_category TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vendors_business_vat
    ON vendors (business_id, vat_number) WHERE vat_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_business ON vendors(business_id);

-- =========================================================================
-- bills
-- =========================================================================
CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,

    bill_number TEXT,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,

    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'SAR',

    status bill_status NOT NULL DEFAULT 'draft',
    notes TEXT,

    -- v2: link to a matched bank transaction
    bank_transaction_id UUID,

    workflow_state JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_bills_total_nonneg CHECK (total >= 0),
    CONSTRAINT chk_bills_due_after_issue CHECK (due_date >= issue_date)
);

CREATE INDEX IF NOT EXISTS idx_bills_business ON bills(business_id);
CREATE INDEX IF NOT EXISTS idx_bills_vendor ON bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills(due_date);
CREATE INDEX IF NOT EXISTS idx_bills_business_status_due
    ON bills(business_id, status, due_date);

-- =========================================================================
-- bill_line_items
-- =========================================================================
CREATE TABLE IF NOT EXISTS bill_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    category TEXT,
    cost_center TEXT,
    line_order INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT chk_bill_line_amount_nonneg CHECK (amount >= 0),
    CONSTRAINT chk_bill_line_quantity_pos CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_bill_line_items_bill ON bill_line_items(bill_id);

-- =========================================================================
-- bill_attachments
-- =========================================================================
CREATE TABLE IF NOT EXISTS bill_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT,
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_attachments_bill ON bill_attachments(bill_id);

-- =========================================================================
-- bill_payments
-- =========================================================================
CREATE TABLE IF NOT EXISTS bill_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount NUMERIC(12, 2) NOT NULL,
    method payment_method NOT NULL DEFAULT 'bank_transfer',
    reference_number TEXT,
    confirmation_attachment_key TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_bill_payment_amount_pos CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_bill_payments_bill ON bill_payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_paid_at ON bill_payments(paid_at);

-- =========================================================================
-- bill_audit_log
-- =========================================================================
CREATE TABLE IF NOT EXISTS bill_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL CHECK (action IN (
        'created', 'submitted', 'approved', 'paid', 'edited', 'voided'
    )),
    old_state JSONB,
    new_state JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_audit_log_bill ON bill_audit_log(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_audit_log_created ON bill_audit_log(created_at);

-- =========================================================================
-- updated_at triggers (reuses handle_updated_at() from 001_initial_schema)
-- =========================================================================
DROP TRIGGER IF EXISTS set_updated_at_vendors ON vendors;
CREATE TRIGGER set_updated_at_vendors
    BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_bills ON bills;
CREATE TRIGGER set_updated_at_bills
    BEFORE UPDATE ON bills
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =========================================================================
-- Audit trigger: log bill INSERT/UPDATE into bill_audit_log
-- =========================================================================
CREATE OR REPLACE FUNCTION log_bill_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
    v_user UUID;
BEGIN
    -- Resolve acting user (may be NULL in service-role / trigger contexts)
    BEGIN
        v_user := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user := NULL;
    END;

    IF TG_OP = 'INSERT' THEN
        v_action := 'created';
        INSERT INTO bill_audit_log (bill_id, user_id, action, old_state, new_state)
        VALUES (NEW.id, COALESCE(NEW.created_by, v_user), v_action, NULL, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Derive action from status transition, fall back to 'edited'
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            v_action := CASE NEW.status
                WHEN 'pending'  THEN 'submitted'
                WHEN 'approved' THEN 'approved'
                WHEN 'paid'     THEN 'paid'
                WHEN 'void'     THEN 'voided'
                ELSE 'edited'
            END;
        ELSE
            v_action := 'edited';
        END IF;

        INSERT INTO bill_audit_log (bill_id, user_id, action, old_state, new_state)
        VALUES (NEW.id, v_user, v_action, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_bills_audit ON bills;
CREATE TRIGGER trg_bills_audit
    AFTER INSERT OR UPDATE ON bills
    FOR EACH ROW EXECUTE FUNCTION log_bill_audit();

-- =========================================================================
-- RLS
-- =========================================================================
ALTER TABLE vendors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_line_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_attachments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_audit_log    ENABLE ROW LEVEL SECURITY;

-- vendors
CREATE POLICY "vendors_select_own" ON vendors
    FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "vendors_insert_own" ON vendors
    FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "vendors_update_own" ON vendors
    FOR UPDATE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()))
              WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "vendors_delete_own" ON vendors
    FOR DELETE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- bills
CREATE POLICY "bills_select_own" ON bills
    FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "bills_insert_own" ON bills
    FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "bills_update_own" ON bills
    FOR UPDATE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()))
              WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "bills_delete_own" ON bills
    FOR DELETE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- bill_line_items: access via parent bill
CREATE POLICY "bill_line_items_select_own" ON bill_line_items
    FOR SELECT USING (bill_id IN (
        SELECT id FROM bills WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ));
CREATE POLICY "bill_line_items_insert_own" ON bill_line_items
    FOR INSERT WITH CHECK (bill_id IN (
        SELECT id FROM bills WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ));
CREATE POLICY "bill_line_items_update_own" ON bill_line_items
    FOR UPDATE USING (bill_id IN (
        SELECT id FROM bills WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ))
    WITH CHECK (bill_id IN (
        SELECT id FROM bills WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ));
CREATE POLICY "bill_line_items_delete_own" ON bill_line_items
    FOR DELETE USING (bill_id IN (
        SELECT id FROM bills WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ));

-- bill_attachments: access via parent bill
CREATE POLICY "bill_attachments_select_own" ON bill_attachments
    FOR SELECT USING (bill_id IN (
        SELECT id FROM bills WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ));
CREATE POLICY "bill_attachments_insert_own" ON bill_attachments
    FOR INSERT WITH CHECK (bill_id IN (
        SELECT id FROM bills WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ));
CREATE POLICY "bill_attachments_update_own" ON bill_attachments
    FOR UPDATE USING (bill_id IN (
        SELECT id FROM bills WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ))
    WITH CHECK (bill_id IN (
        SELECT id FROM bills WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ));
CREATE POLICY "bill_attachments_delete_own" ON bill_attachments
    FOR DELETE USING (bill_id IN (
        SELECT id FROM bills WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ));

-- bill_payments: access via parent bill
CREATE POLICY "bill_payments_select_own" ON bill_payments
    FOR SELECT USING (bill_id IN (
        SELECT id FROM bills WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ));
CREATE POLICY "bill_payments_insert_own" ON bill_payments
    FOR INSERT WITH CHECK (bill_id IN (
        SELECT id FROM bills WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ));
CREATE POLICY "bill_payments_update_own" ON bill_payments
    FOR UPDATE USING (bill_id IN (
        SELECT id FROM bills WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ))
    WITH CHECK (bill_id IN (
        SELECT id FROM bills WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ));
CREATE POLICY "bill_payments_delete_own" ON bill_payments
    FOR DELETE USING (bill_id IN (
        SELECT id FROM bills WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ));

-- bill_audit_log: read-only for owners; inserts come from SECURITY DEFINER trigger
CREATE POLICY "bill_audit_log_select_own" ON bill_audit_log
    FOR SELECT USING (bill_id IN (
        SELECT id FROM bills WHERE business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    ));

-- Rollback:
--   DROP TABLE IF EXISTS bill_audit_log, bill_payments, bill_attachments,
--                        bill_line_items, bills, vendors CASCADE;
--   DROP FUNCTION IF EXISTS log_bill_audit();
--   DROP TYPE IF EXISTS payment_method;
--   DROP TYPE IF EXISTS bill_status;
