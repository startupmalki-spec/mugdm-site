-- AI usage tracking table for multi-LLM model routing
-- Tracks per-user API calls, model selection, token usage, and cost estimates

CREATE TABLE ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_estimate NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_log_select" ON ai_usage_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ai_usage_log_insert" ON ai_usage_log
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ai_usage_log_user_date ON ai_usage_log(user_id, created_at);

-- Rollback: DROP TABLE IF EXISTS ai_usage_log;
