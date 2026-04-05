-- V88: AI Impact Metrics table
-- Tracks per-POD per-period metrics for AI tooling adoption impact.
-- metric_type values: ai_pr_ratio | velocity_delta | cost_per_point | review_cycle_days

CREATE TABLE IF NOT EXISTS ai_impact_metric (
    id              BIGSERIAL PRIMARY KEY,
    metric_type     VARCHAR(50)      NOT NULL,
    pod_name        VARCHAR(100)     NOT NULL,
    period          VARCHAR(20)      NOT NULL,  -- e.g. '2025-10', '2025-11'
    value           NUMERIC(12, 4)   NOT NULL,
    baseline_value  NUMERIC(12, 4),             -- pre-AI baseline for delta metrics
    notes           TEXT,
    created_at      TIMESTAMP        NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aim_type_pod  ON ai_impact_metric (metric_type, pod_name);
CREATE INDEX IF NOT EXISTS idx_aim_period    ON ai_impact_metric (period);

-- ── Seed 6 months of sample data across 4 PODs ──────────────────────────────
-- Periods: Oct-25 → Mar-26

INSERT INTO ai_impact_metric (metric_type, pod_name, period, value, baseline_value, notes) VALUES
-- ai_pr_ratio: fraction of PRs with AI suggestions (0.0 – 1.0)
('ai_pr_ratio', 'Portal V1',      '2025-10', 0.12, 0.00, 'Pilot start'),
('ai_pr_ratio', 'Portal V1',      '2025-11', 0.25, 0.00, NULL),
('ai_pr_ratio', 'Portal V1',      '2025-12', 0.38, 0.00, NULL),
('ai_pr_ratio', 'Portal V1',      '2026-01', 0.49, 0.00, NULL),
('ai_pr_ratio', 'Portal V1',      '2026-02', 0.61, 0.00, NULL),
('ai_pr_ratio', 'Portal V1',      '2026-03', 0.72, 0.00, NULL),

('ai_pr_ratio', 'Portal V2',      '2025-10', 0.08, 0.00, NULL),
('ai_pr_ratio', 'Portal V2',      '2025-11', 0.19, 0.00, NULL),
('ai_pr_ratio', 'Portal V2',      '2025-12', 0.33, 0.00, NULL),
('ai_pr_ratio', 'Portal V2',      '2026-01', 0.44, 0.00, NULL),
('ai_pr_ratio', 'Portal V2',      '2026-02', 0.55, 0.00, NULL),
('ai_pr_ratio', 'Portal V2',      '2026-03', 0.66, 0.00, NULL),

('ai_pr_ratio', 'Integrations',   '2025-10', 0.20, 0.00, 'Early adopter'),
('ai_pr_ratio', 'Integrations',   '2025-11', 0.34, 0.00, NULL),
('ai_pr_ratio', 'Integrations',   '2025-12', 0.45, 0.00, NULL),
('ai_pr_ratio', 'Integrations',   '2026-01', 0.58, 0.00, NULL),
('ai_pr_ratio', 'Integrations',   '2026-02', 0.70, 0.00, NULL),
('ai_pr_ratio', 'Integrations',   '2026-03', 0.79, 0.00, NULL),

('ai_pr_ratio', 'Accessioning',   '2025-10', 0.05, 0.00, NULL),
('ai_pr_ratio', 'Accessioning',   '2025-11', 0.12, 0.00, NULL),
('ai_pr_ratio', 'Accessioning',   '2025-12', 0.22, 0.00, NULL),
('ai_pr_ratio', 'Accessioning',   '2026-01', 0.31, 0.00, NULL),
('ai_pr_ratio', 'Accessioning',   '2026-02', 0.43, 0.00, NULL),
('ai_pr_ratio', 'Accessioning',   '2026-03', 0.56, 0.00, NULL),

-- velocity_delta: story points per sprint (value=AI-assisted, baseline=pre-AI)
('velocity_delta', 'Portal V1',   '2025-10', 38,  32, NULL),
('velocity_delta', 'Portal V1',   '2025-11', 41,  33, NULL),
('velocity_delta', 'Portal V1',   '2025-12', 45,  33, NULL),
('velocity_delta', 'Portal V1',   '2026-01', 48,  34, NULL),
('velocity_delta', 'Portal V1',   '2026-02', 52,  34, NULL),
('velocity_delta', 'Portal V1',   '2026-03', 55,  35, NULL),

('velocity_delta', 'Portal V2',   '2025-10', 30,  28, NULL),
('velocity_delta', 'Portal V2',   '2025-11', 33,  28, NULL),
('velocity_delta', 'Portal V2',   '2025-12', 36,  29, NULL),
('velocity_delta', 'Portal V2',   '2026-01', 39,  29, NULL),
('velocity_delta', 'Portal V2',   '2026-02', 43,  30, NULL),
('velocity_delta', 'Portal V2',   '2026-03', 46,  30, NULL),

('velocity_delta', 'Integrations','2025-10', 42,  36, NULL),
('velocity_delta', 'Integrations','2025-11', 46,  36, NULL),
('velocity_delta', 'Integrations','2025-12', 50,  37, NULL),
('velocity_delta', 'Integrations','2026-01', 54,  37, NULL),
('velocity_delta', 'Integrations','2026-02', 58,  38, NULL),
('velocity_delta', 'Integrations','2026-03', 62,  38, NULL),

('velocity_delta', 'Accessioning','2025-10', 25,  24, NULL),
('velocity_delta', 'Accessioning','2025-11', 27,  24, NULL),
('velocity_delta', 'Accessioning','2025-12', 29,  24, NULL),
('velocity_delta', 'Accessioning','2026-01', 31,  25, NULL),
('velocity_delta', 'Accessioning','2026-02', 34,  25, NULL),
('velocity_delta', 'Accessioning','2026-03', 37,  25, NULL),

-- cost_per_point: cost in USD per story point (lower = better after AI)
('cost_per_point', 'Portal V1',   '2025-10', 820, 950, NULL),
('cost_per_point', 'Portal V1',   '2025-11', 790, 950, NULL),
('cost_per_point', 'Portal V1',   '2025-12', 755, 950, NULL),
('cost_per_point', 'Portal V1',   '2026-01', 720, 950, NULL),
('cost_per_point', 'Portal V1',   '2026-02', 690, 950, NULL),
('cost_per_point', 'Portal V1',   '2026-03', 660, 950, NULL),

('cost_per_point', 'Integrations','2025-10', 870, 1020, NULL),
('cost_per_point', 'Integrations','2025-11', 830, 1020, NULL),
('cost_per_point', 'Integrations','2025-12', 790, 1020, NULL),
('cost_per_point', 'Integrations','2026-01', 750, 1020, NULL),
('cost_per_point', 'Integrations','2026-02', 710, 1020, NULL),
('cost_per_point', 'Integrations','2026-03', 675, 1020, NULL),

-- review_cycle_days: avg PR review cycle time in days (lower = better)
('review_cycle_days', 'Portal V1',     '2025-10', 3.2, 4.5, NULL),
('review_cycle_days', 'Portal V1',     '2025-11', 2.9, 4.5, NULL),
('review_cycle_days', 'Portal V1',     '2025-12', 2.6, 4.5, NULL),
('review_cycle_days', 'Portal V1',     '2026-01', 2.3, 4.5, NULL),
('review_cycle_days', 'Portal V1',     '2026-02', 2.1, 4.5, NULL),
('review_cycle_days', 'Portal V1',     '2026-03', 1.9, 4.5, NULL),

('review_cycle_days', 'Integrations',  '2025-10', 2.8, 4.0, NULL),
('review_cycle_days', 'Integrations',  '2025-11', 2.5, 4.0, NULL),
('review_cycle_days', 'Integrations',  '2025-12', 2.2, 4.0, NULL),
('review_cycle_days', 'Integrations',  '2026-01', 2.0, 4.0, NULL),
('review_cycle_days', 'Integrations',  '2026-02', 1.8, 4.0, NULL),
('review_cycle_days', 'Integrations',  '2026-03', 1.6, 4.0, NULL)

ON CONFLICT DO NOTHING;
