-- V40: NLP Learner / Optimizer + user feedback
-- Adds user_rating to query log and creates learned_pattern table

-- 1. Add feedback rating to query log
ALTER TABLE nlp_query_log ADD COLUMN IF NOT EXISTS user_rating SMALLINT DEFAULT NULL;
-- NULL = no rating, 1 = thumbs up, -1 = thumbs down

-- 2. Add entity_name to query log for easier pattern mining
ALTER TABLE nlp_query_log ADD COLUMN IF NOT EXISTS entity_name VARCHAR(255) DEFAULT NULL;

-- 3. Create learned patterns table
CREATE TABLE IF NOT EXISTS nlp_learned_pattern (
    id              BIGSERIAL PRIMARY KEY,
    query_pattern   VARCHAR(500)  NOT NULL,       -- exact query or regex pattern
    pattern_type    VARCHAR(20)   NOT NULL DEFAULT 'EXACT',  -- EXACT, REGEX, FUZZY
    resolved_intent VARCHAR(50)   NOT NULL,        -- NAVIGATE, INSIGHT, DATA_QUERY, etc.
    entity_name     VARCHAR(255)  DEFAULT NULL,    -- matched entity
    route           VARCHAR(255)  DEFAULT NULL,    -- route to navigate to
    confidence      DECIMAL(3,2)  NOT NULL DEFAULT 0.90,
    source          VARCHAR(30)   NOT NULL DEFAULT 'LOG_MINING', -- LOG_MINING, USER_FEEDBACK, MANUAL
    times_seen      INTEGER       NOT NULL DEFAULT 1,
    positive_votes  INTEGER       NOT NULL DEFAULT 0,
    negative_votes  INTEGER       NOT NULL DEFAULT 0,
    active          BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nlp_learned_pattern_active ON nlp_learned_pattern(active);
CREATE INDEX IF NOT EXISTS idx_nlp_learned_pattern_query ON nlp_learned_pattern(query_pattern);

-- 4. Index on nlp_query_log for learner queries
CREATE INDEX IF NOT EXISTS idx_nlp_query_log_confidence ON nlp_query_log(confidence);
CREATE INDEX IF NOT EXISTS idx_nlp_query_log_intent ON nlp_query_log(intent);
CREATE INDEX IF NOT EXISTS idx_nlp_query_log_rating ON nlp_query_log(user_rating);

-- 5. Page permission for NLP Optimizer (admin-only like audit log)
INSERT INTO page_permission (role, page_key, allowed) VALUES
    ('ADMIN', 'nlp_optimizer', TRUE)
ON CONFLICT DO NOTHING;
