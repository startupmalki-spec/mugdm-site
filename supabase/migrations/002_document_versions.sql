-- Add version tracking columns to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES documents(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;

-- Index for efficient version chain lookups
CREATE INDEX IF NOT EXISTS idx_documents_previous_version_id ON documents(previous_version_id);

-- Index for finding latest versions by type and registration number
CREATE INDEX IF NOT EXISTS idx_documents_type_business ON documents(business_id, type) WHERE is_current = true;
