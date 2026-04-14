-- RAG + multi-agent orchestration scaffolding.
-- Adds pgvector extension + document/chunk tables with RLS inheriting from businesses.
-- Mirrors the RLS pattern from 011/015:
--   business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
-- with the extra allowance that business_id IS NULL means "global regulations corpus"
-- and is readable by any authenticated user.

CREATE EXTENSION IF NOT EXISTS vector;

-- =========================================================================
-- source_type enum
-- =========================================================================
DO $$ BEGIN
    CREATE TYPE rag_source_type AS ENUM (
        'bill',
        'vendor',
        'transaction',
        'zatca_reg',
        'gosi_reg',
        'socpa',
        'product_doc'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- rag_documents
-- =========================================================================
CREATE TABLE IF NOT EXISTS rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NULL REFERENCES businesses(id) ON DELETE CASCADE,
    source_type rag_source_type NOT NULL,
    source_id UUID NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_documents_business ON rag_documents(business_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_source ON rag_documents(source_type, source_id);

CREATE TRIGGER rag_documents_updated_at
    BEFORE UPDATE ON rag_documents
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =========================================================================
-- rag_chunks
-- =========================================================================
CREATE TABLE IF NOT EXISTS rag_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1024),
    token_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_document ON rag_chunks(document_id);

-- ivfflat index for ANN search on embedding (cosine distance).
-- NOTE: ivfflat needs ANALYZE data present before it performs well; cold-start
-- will fall back to sequential scan. Tune `lists` after corpus is loaded.
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding
    ON rag_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- =========================================================================
-- RLS
-- =========================================================================
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rag_documents_select ON rag_documents;
CREATE POLICY rag_documents_select ON rag_documents
    FOR SELECT
    USING (
        business_id IS NULL
        OR business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS rag_documents_modify ON rag_documents;
CREATE POLICY rag_documents_modify ON rag_documents
    FOR ALL
    USING (
        business_id IS NOT NULL
        AND business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    )
    WITH CHECK (
        business_id IS NOT NULL
        AND business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS rag_chunks_select ON rag_chunks;
CREATE POLICY rag_chunks_select ON rag_chunks
    FOR SELECT
    USING (
        document_id IN (
            SELECT id FROM rag_documents
            WHERE business_id IS NULL
               OR business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS rag_chunks_modify ON rag_chunks;
CREATE POLICY rag_chunks_modify ON rag_chunks
    FOR ALL
    USING (
        document_id IN (
            SELECT id FROM rag_documents
            WHERE business_id IS NOT NULL
              AND business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
        )
    )
    WITH CHECK (
        document_id IN (
            SELECT id FROM rag_documents
            WHERE business_id IS NOT NULL
              AND business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
        )
    );

-- =========================================================================
-- match_rag_chunks RPC
-- =========================================================================
-- SECURITY INVOKER so RLS applies to caller. Cosine similarity (1 - distance).
CREATE OR REPLACE FUNCTION match_rag_chunks(
    query_embedding vector(1024),
    match_count INT DEFAULT 8,
    filter_business_id UUID DEFAULT NULL,
    filter_source_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    metadata JSONB,
    source_type TEXT,
    score FLOAT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id AS chunk_id,
        c.document_id,
        c.content,
        d.metadata,
        d.source_type::TEXT,
        1 - (c.embedding <=> query_embedding) AS score
    FROM rag_chunks c
    JOIN rag_documents d ON d.id = c.document_id
    WHERE
        c.embedding IS NOT NULL
        AND (
            filter_business_id IS NULL
            OR d.business_id IS NULL
            OR d.business_id = filter_business_id
        )
        AND (
            filter_source_types IS NULL
            OR d.source_type::TEXT = ANY(filter_source_types)
        )
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
