-- V93: Team pulse surveys — weekly mood check-in per resource
CREATE TABLE IF NOT EXISTS team_pulse (
    id          BIGSERIAL PRIMARY KEY,
    resource_id BIGINT    NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
    week_start  DATE      NOT NULL,
    score       SMALLINT  NOT NULL CHECK (score BETWEEN 1 AND 5),
    comment     TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_pulse_resource_week UNIQUE (resource_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_team_pulse_week ON team_pulse(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_team_pulse_resource ON team_pulse(resource_id);
