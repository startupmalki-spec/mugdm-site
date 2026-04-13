-- Task 56: ZATCA onboarding wizard
-- Adds a flag to `businesses` marking that the ZATCA Phase-2 onboarding
-- (compliance CSID → compliance check → production CSID) has succeeded.

ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS zatca_onboarded BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_businesses_zatca_onboarded
    ON businesses(zatca_onboarded)
    WHERE zatca_onboarded = TRUE;

-- Rollback:
--   DROP INDEX IF EXISTS idx_businesses_zatca_onboarded;
--   ALTER TABLE businesses DROP COLUMN IF EXISTS zatca_onboarded;
