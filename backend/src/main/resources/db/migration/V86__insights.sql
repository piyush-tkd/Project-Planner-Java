-- V86: Proactive Insights — stores detected signals from the AI Insights Engine.
-- Each row is one detected signal (overallocation, deadline risk, etc.).
-- The engine re-runs on a schedule; previously acknowledged insights are preserved.

CREATE TABLE insight (
    id              BIGSERIAL PRIMARY KEY,
    -- Signal type: DEADLINE_RISK | OVERALLOCATION | RESOURCE_CONFLICT | STALE_PROJECT | OPEN_HIGH_RISK
    insight_type    VARCHAR(60)  NOT NULL,
    -- HIGH | MEDIUM | LOW
    severity        VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM',
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    -- Entity that triggered the insight: PROJECT | RESOURCE | POD
    entity_type     VARCHAR(40),
    entity_id       BIGINT,
    entity_name     VARCHAR(255),
    detected_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    -- Once acknowledged, the insight is hidden from the active feed
    acknowledged    BOOLEAN      NOT NULL DEFAULT FALSE,
    acknowledged_by VARCHAR(255),
    acknowledged_at TIMESTAMP
);

-- Index for the common query: unacknowledged insights ordered by severity
CREATE INDEX idx_insight_unacked ON insight (acknowledged, severity, detected_at DESC);
