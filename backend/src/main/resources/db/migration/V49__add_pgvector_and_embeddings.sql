-- ============================================================================
-- V49: Add pgvector extension and entity embeddings table for semantic search
-- ============================================================================
-- Requires: PostgreSQL 16 with pgvector extension installed
-- Install:  sudo apt install postgresql-16-pgvector  (Linux)
--           Or: CREATE EXTENSION IF NOT EXISTS vector;  (if already available)
-- ============================================================================

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Entity embeddings table ─────────────────────────────────────────────────
-- Stores vector embeddings for all entities (resources, projects, pods, etc.)
-- and learned query→intent pairs for semantic search.
CREATE TABLE nlp_embedding (
    id              BIGSERIAL PRIMARY KEY,
    entity_type     VARCHAR(50)  NOT NULL,   -- RESOURCE, PROJECT, POD, SPRINT, RELEASE, QUERY_PATTERN, COST_RATE, EFFORT_PATTERN
    entity_id       BIGINT,                  -- FK to the source entity (nullable for query patterns)
    entity_name     VARCHAR(500),            -- Human-readable label
    content_text    TEXT         NOT NULL,    -- The text that was embedded
    embedding       vector(1024),            -- Ollama nomic-embed-text produces 768d; mxbai-embed-large produces 1024d
    intent          VARCHAR(50),             -- For QUERY_PATTERN type: the resolved intent
    route           VARCHAR(200),            -- For QUERY_PATTERN type: the resolved route
    metadata        JSONB,                   -- Extra structured info (role, location, pod, status, etc.)
    source          VARCHAR(30)  NOT NULL DEFAULT 'CATALOG',  -- CATALOG, QUERY_LOG, LEARNER, MANUAL
    confidence      DOUBLE PRECISION DEFAULT 1.0,
    active          BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
-- IVFFlat index for approximate nearest-neighbor search (fast cosine similarity)
-- lists = sqrt(expected_rows) is a good starting point; 100 covers up to ~10k rows
CREATE INDEX idx_nlp_embedding_vector ON nlp_embedding
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Lookup indexes
CREATE INDEX idx_nlp_embedding_entity_type ON nlp_embedding (entity_type);
CREATE INDEX idx_nlp_embedding_entity_id ON nlp_embedding (entity_type, entity_id);
CREATE INDEX idx_nlp_embedding_active ON nlp_embedding (active) WHERE active = true;
CREATE INDEX idx_nlp_embedding_source ON nlp_embedding (source);
CREATE INDEX idx_nlp_embedding_intent ON nlp_embedding (intent) WHERE intent IS NOT NULL;

-- GIN index on metadata JSONB for flexible filtering
CREATE INDEX idx_nlp_embedding_metadata ON nlp_embedding USING gin (metadata);
