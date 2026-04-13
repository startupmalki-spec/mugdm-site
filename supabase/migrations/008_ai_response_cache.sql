-- Phase 1 — AI Optimization
-- Extends ai_usage_log with task/purpose/confidence columns and adds ai_response_cache.
-- See PRD_AI_OPTIMIZATION.md §3–§4.

-- 1. Extend ai_usage_log
ALTER TABLE ai_usage_log
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS task_type TEXT,
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS escalated BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE ai_usage_log
  DROP CONSTRAINT IF EXISTS chk_ai_usage_log_purpose;
ALTER TABLE ai_usage_log
  ADD CONSTRAINT chk_ai_usage_log_purpose
    CHECK (purpose IN ('user', 'intelligence_classification', 'system'));

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_purpose_date
  ON ai_usage_log(user_id, purpose, created_at);

-- Add CHECK on ai_confidence range for consistency with documents/transactions in 001
ALTER TABLE ai_usage_log
  DROP CONSTRAINT IF EXISTS chk_ai_usage_log_confidence;
ALTER TABLE ai_usage_log
  ADD CONSTRAINT chk_ai_usage_log_confidence
    CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1));

-- 2. ai_response_cache (platform-level; service_role only)
CREATE TABLE IF NOT EXISTS ai_response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  task_type TEXT NOT NULL,
  model TEXT NOT NULL,
  response JSONB NOT NULL,
  tokens_saved_in INTEGER NOT NULL DEFAULT 0,
  tokens_saved_out INTEGER NOT NULL DEFAULT 0,
  hit_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT chk_cache_expires_after_created CHECK (expires_at > created_at)
);

-- cache_key has UNIQUE which already creates the lookup index; no separate idx needed.
CREATE INDEX IF NOT EXISTS idx_ai_response_cache_expiry ON ai_response_cache(expires_at);

ALTER TABLE ai_response_cache ENABLE ROW LEVEL SECURITY;
-- No policies: user clients cannot read/write. Service role bypasses RLS.

-- Rollback:
--   DROP TABLE IF EXISTS ai_response_cache;
--   ALTER TABLE ai_usage_log
--     DROP CONSTRAINT IF EXISTS chk_ai_usage_log_purpose,
--     DROP CONSTRAINT IF EXISTS chk_ai_usage_log_confidence,
--     DROP COLUMN IF EXISTS escalated,
--     DROP COLUMN IF EXISTS ai_confidence,
--     DROP COLUMN IF EXISTS purpose,
--     DROP COLUMN IF EXISTS task_type,
--     DROP COLUMN IF EXISTS business_id;
--   DROP INDEX IF EXISTS idx_ai_usage_log_purpose_date;
