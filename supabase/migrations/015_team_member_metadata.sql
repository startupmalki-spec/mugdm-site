-- Team member metadata: documents, salary history, leave records
-- Migrated from localStorage to database for persistence across devices

CREATE TABLE IF NOT EXISTS team_member_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  metadata_type TEXT NOT NULL CHECK (metadata_type IN ('salary_change', 'leave_record', 'document')),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_meta_member ON team_member_metadata(team_member_id);
CREATE INDEX IF NOT EXISTS idx_team_meta_business ON team_member_metadata(business_id);

ALTER TABLE team_member_metadata ENABLE ROW LEVEL SECURITY;

-- Users can only access metadata for their own business
CREATE POLICY "Users can view own business team metadata"
  ON team_member_metadata FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own business team metadata"
  ON team_member_metadata FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own business team metadata"
  ON team_member_metadata FOR DELETE
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
