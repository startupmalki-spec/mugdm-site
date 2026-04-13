-- Wathq (Saudi MoC) commercial registration API integration.
--
-- Adds:
--   * businesses.wathq_last_checked_at — timestamp of the most recent Wathq lookup
--   * businesses.wathq_cr_status        — last reported CR status from Wathq
--   * businesses.cr_source              — provenance of the stored CR data
--   * wathq_lookup_log                  — per-user lookup audit + rate-limit source
--
-- The cr_source CHECK constraint allows 'wathq_api' from day one so that the
-- onboarding flow's first save can already mark the source.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS wathq_last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wathq_cr_status       TEXT,
  ADD COLUMN IF NOT EXISTS cr_source             TEXT NOT NULL DEFAULT 'manual';

-- Drop any prior version of the constraint before re-adding (idempotent).
ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_cr_source_check;

ALTER TABLE businesses
  ADD CONSTRAINT businesses_cr_source_check
  CHECK (cr_source IN ('manual', 'wathq_api', 'document_ocr', 'qr_webpage'));

-- Per-user Wathq lookup audit log. Used both for the 10/user/day rate limit
-- and for diagnosing API quota usage.
CREATE TABLE IF NOT EXISTS wathq_lookup_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cr_number   TEXT NOT NULL,
  success     BOOLEAN NOT NULL,
  error_code  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wathq_lookup_log_user_created_idx
  ON wathq_lookup_log (user_id, created_at DESC);

ALTER TABLE wathq_lookup_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own log rows; writes happen only via the service role
-- key from server routes.
DROP POLICY IF EXISTS "wathq_lookup_log_select_own" ON wathq_lookup_log;
CREATE POLICY "wathq_lookup_log_select_own" ON wathq_lookup_log
  FOR SELECT USING (auth.uid() = user_id);
