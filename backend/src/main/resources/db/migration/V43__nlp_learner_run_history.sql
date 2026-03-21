-- Track every NLP learner run so admins can see how the system improves over time
CREATE TABLE nlp_learner_run (
    id              BIGSERIAL PRIMARY KEY,
    run_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    duration_ms     INTEGER,
    total_queries   BIGINT NOT NULL DEFAULT 0,
    unknown_queries BIGINT NOT NULL DEFAULT 0,
    low_confidence  BIGINT NOT NULL DEFAULT 0,
    positive_ratings BIGINT NOT NULL DEFAULT 0,
    negative_ratings BIGINT NOT NULL DEFAULT 0,
    active_patterns BIGINT NOT NULL DEFAULT 0,
    new_patterns    BIGINT NOT NULL DEFAULT 0,
    strategy_count  INTEGER NOT NULL DEFAULT 0,
    intent_distribution TEXT,          -- JSON string of intent → count
    strategy_confidence TEXT           -- JSON string of strategy → avg confidence
);
