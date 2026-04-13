-- ZATCA B2C simplified-invoice reporting queue.
-- Task 64: background reporting worker.
--
-- Simplified (B2C) invoices have a 24h reporting window per ZATCA. We
-- optimistically mark them `pending_clearance` locally with the signed XML +
-- TLV QR already computed, and enqueue a row here. A cron worker
-- (`/api/cron/process-report-queue`) pulls rows whose `next_attempt_at <= now()`
-- and calls the reporting pipeline with exponential backoff.
--
-- Backoff schedule (attempts column tracks count AFTER the attempt runs):
--   attempt 1: immediate (on enqueue)
--   attempt 2: +5 min
--   attempt 3: +30 min
--   attempt 4: +2 hr
--   attempt 5: +12 hr
--   attempt 6+: dead_letter = true, nudge opened.

CREATE TABLE IF NOT EXISTS zatca_report_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error TEXT,
    dead_letter BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_zatca_report_queue_invoice UNIQUE (invoice_id)
);

-- Worker polling index: rows ready to run (not dead_lettered, due now).
CREATE INDEX IF NOT EXISTS idx_zatca_report_queue_ready
    ON zatca_report_queue (next_attempt_at)
    WHERE NOT dead_letter;

-- Dashboard / health query index.
CREATE INDEX IF NOT EXISTS idx_zatca_report_queue_business
    ON zatca_report_queue (business_id, dead_letter, next_attempt_at);

-- =========================================================================
-- RLS: owners may READ rows for their business; writes service-role only.
-- =========================================================================
ALTER TABLE zatca_report_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zatca_report_queue_select_own" ON zatca_report_queue
    FOR SELECT USING (
        business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

-- Rollback:
--   DROP TABLE IF EXISTS zatca_report_queue CASCADE;
