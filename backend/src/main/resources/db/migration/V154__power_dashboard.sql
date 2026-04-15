-- Power Dashboard: saved dashboards and their widget configurations
-- Supports "Power Mode" — fully dynamic, any-field query builder

CREATE TABLE power_dashboard (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    created_by  VARCHAR(255),
    is_public   BOOLEAN DEFAULT false,
    tags        VARCHAR(500),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE power_dashboard_widget (
    id           BIGSERIAL PRIMARY KEY,
    dashboard_id BIGINT NOT NULL REFERENCES power_dashboard(id) ON DELETE CASCADE,
    title        VARCHAR(255),
    widget_type  VARCHAR(50) NOT NULL,  -- kpi_card|bar|stacked_bar|line|pie|table|heatmap|velocity|worklog|leaderboard
    config       JSONB NOT NULL DEFAULT '{}',  -- full widget query + display config
    position     JSONB NOT NULL DEFAULT '{"x":0,"y":0,"w":6,"h":4}',
    sort_order   INT DEFAULT 0,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_power_dashboard_widget_dashboard_id ON power_dashboard_widget(dashboard_id);

-- Page permissions — one row per role
INSERT INTO page_permission (role, page_key, allowed) VALUES
  ('ADMIN',      'power_dashboard', true),
  ('READ_WRITE', 'power_dashboard', true),
  ('READ_ONLY',  'power_dashboard', true)
ON CONFLICT (role, page_key) DO NOTHING;

SELECT setval('page_permission_id_seq', (SELECT COALESCE(MAX(id), 1) FROM page_permission), true);
