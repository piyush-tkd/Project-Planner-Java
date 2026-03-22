-- ============================================================================
-- V50: Fix pgvector setup — split extension+column from index creation
-- ============================================================================
-- V49's DO block rolled back everything when IVFFlat index creation failed
-- on an empty table (IVFFlat requires existing rows to train centroids).
-- This migration re-attempts in two separate blocks so the column survives
-- even if the index fails.
-- ============================================================================

-- ── Step 1: Enable pgvector extension (separate block) ───────────────────
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
    RAISE NOTICE 'pgvector extension enabled';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not available: %', SQLERRM;
END;
$$;

-- ── Step 2: Add the vector column if it doesn't exist ────────────────────
DO $$
BEGIN
    -- Only add if the extension was loaded and column is missing
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'nlp_embedding' AND column_name = 'embedding'
        ) THEN
            ALTER TABLE nlp_embedding ADD COLUMN embedding vector(1024);
            RAISE NOTICE 'embedding vector column added';
        ELSE
            RAISE NOTICE 'embedding column already exists';
        END IF;
    ELSE
        RAISE NOTICE 'skipping embedding column — pgvector extension not available';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to add embedding column: %', SQLERRM;
END;
$$;

-- ── Step 3: Create index (HNSW instead of IVFFlat — works on empty tables) ─
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'nlp_embedding' AND column_name = 'embedding'
    ) THEN
        -- Drop the IVFFlat index if it somehow exists from a previous attempt
        DROP INDEX IF EXISTS idx_nlp_embedding_vector;

        -- HNSW index works on empty tables (unlike IVFFlat which needs training data)
        CREATE INDEX idx_nlp_embedding_vector ON nlp_embedding
            USING hnsw (embedding vector_cosine_ops);

        RAISE NOTICE 'HNSW vector index created';
    ELSE
        RAISE NOTICE 'skipping index — embedding column not present';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to create vector index: %', SQLERRM;
END;
$$;
