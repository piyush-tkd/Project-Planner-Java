-- ============================================================
-- Portfolio Planner AI Service — schema migrations
-- All AI tables live in the 'ai' schema to stay completely
-- separate from the main application's public schema.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS ai;

-- ── Vector store (Spring AI standard format)
-- Spring AI's PgVectorStore reads/writes this table.
-- 'metadata' JSONB holds entity_type, entity_id, chunk_index, etc.
CREATE TABLE IF NOT EXISTS ai.vector_store (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content  TEXT    NOT NULL,
    metadata JSONB,
    embedding VECTOR(768)
);

-- HNSW index for fast approximate nearest-neighbour cosine search
CREATE INDEX IF NOT EXISTS idx_ai_vs_embedding
    ON ai.vector_store USING hnsw (embedding vector_cosine_ops);

-- Metadata index for filtered lookups (e.g. entity_type = 'PROJECT')
CREATE INDEX IF NOT EXISTS idx_ai_vs_metadata
    ON ai.vector_store USING gin (metadata);

-- ── Conversation log
-- Persists every AI Hub query + response for debugging and feedback.
CREATE TABLE IF NOT EXISTS ai.conversations (
    id          BIGSERIAL PRIMARY KEY,
    session_id  VARCHAR(128),
    query       TEXT        NOT NULL,
    response    TEXT,
    sources     JSONB,           -- array of {entity_type, entity_id, score}
    model_used  VARCHAR(100),
    latency_ms  INT,
    feedback    SMALLINT,        -- 1 = positive, -1 = negative, NULL = none
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_created ON ai.conversations (created_at DESC);

-- ── Sync log
-- Tracks what was last embedded and when, for incremental re-indexing.
CREATE TABLE IF NOT EXISTS ai.sync_log (
    id            BIGSERIAL PRIMARY KEY,
    entity_type   VARCHAR(50)  NOT NULL,  -- PROJECT, RISK, MILESTONE, STORY
    entity_id     BIGINT,                 -- NULL = full re-index run
    chunks_created INT          NOT NULL DEFAULT 0,
    status        VARCHAR(20)  NOT NULL DEFAULT 'SUCCESS',
    error_message TEXT,
    synced_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_sync_entity
    ON ai.sync_log (entity_type, entity_id, synced_at DESC);
