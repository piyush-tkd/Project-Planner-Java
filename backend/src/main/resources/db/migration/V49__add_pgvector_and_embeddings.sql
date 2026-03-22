-- ============================================================================
-- V49: Add entity embeddings table for semantic search
-- ============================================================================
-- pgvector is OPTIONAL. If installed, we enable it and add a vector column +
-- IVFFlat index for semantic nearest-neighbor search.  If not installed, the
-- table still gets created (embedding column as TEXT) so the rest of the app
-- starts normally — semantic search simply stays inactive until pgvector is
-- installed and a manual re-sync is triggered.
--
-- To install pgvector:
--   macOS (Homebrew):  brew install pgvector
--   Linux:             sudo apt install postgresql-16-pgvector
-- Then restart PostgreSQL and run: POST /api/nlp/embeddings/sync
-- ============================================================================

-- ── 1. Create the table WITHOUT the embedding column first ────────────────
CREATE TABLE nlp_embedding (
    id              BIGSERIAL PRIMARY KEY,
    entity_type     VARCHAR(50)  NOT NULL,
    entity_id       BIGINT,
    entity_name     VARCHAR(500),
    content_text    TEXT         NOT NULL,
    intent          VARCHAR(50),
    route           VARCHAR(200),
    metadata        JSONB,
    source          VARCHAR(30)  NOT NULL DEFAULT 'CATALOG',
    confidence      DOUBLE PRECISION DEFAULT 1.0,
    active          BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── 2. Standard lookup indexes (always created) ──────────────────────────
CREATE INDEX idx_nlp_embedding_entity_type ON nlp_embedding (entity_type);
CREATE INDEX idx_nlp_embedding_entity_id ON nlp_embedding (entity_type, entity_id);
CREATE INDEX idx_nlp_embedding_active ON nlp_embedding (active) WHERE active = true;
CREATE INDEX idx_nlp_embedding_source ON nlp_embedding (source);
CREATE INDEX idx_nlp_embedding_intent ON nlp_embedding (intent) WHERE intent IS NOT NULL;
CREATE INDEX idx_nlp_embedding_metadata ON nlp_embedding USING gin (metadata);

-- ── 3. Conditionally enable pgvector + add vector column + IVFFlat index ──
-- If pgvector is not installed this block silently does nothing.
DO $$
BEGIN
    -- Try to enable the extension
    CREATE EXTENSION IF NOT EXISTS vector;

    -- Add the vector column
    ALTER TABLE nlp_embedding ADD COLUMN embedding vector(1024);

    -- IVFFlat index for cosine similarity (lists=100 supports ~10k rows)
    CREATE INDEX idx_nlp_embedding_vector ON nlp_embedding
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

    RAISE NOTICE 'pgvector enabled — semantic search is active';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector not available (%) — semantic search disabled. Install pgvector and run POST /api/nlp/embeddings/sync to activate.', SQLERRM;
END;
$$;
