-- Granular per-page permissions replacing the old catch-all 'reports' key.
-- READ_WRITE gets access to everything except settings (already seeded).
-- READ_ONLY gets access to most views; budget and resource_roi are restricted.

-- ── Capacity Reports ──────────────────────────────────────────────────────────
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'capacity_gap',        true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'capacity_gap',        true)  ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'utilization',         true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'utilization',         true)  ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'slack_buffer',        true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'slack_buffer',        true)  ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'hiring_forecast',     true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'hiring_forecast',     true)  ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'concurrency_risk',    true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'concurrency_risk',    true)  ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'capacity_demand',     true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'capacity_demand',     true)  ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'pod_resources',       true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'pod_resources',       true)  ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'pod_capacity',        true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'pod_capacity',        true)  ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'resource_pod_matrix', true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'resource_pod_matrix', true)  ON CONFLICT (role, page_key) DO NOTHING;

-- ── Portfolio Analysis ────────────────────────────────────────────────────────
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'project_health',      true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'project_health',      true)  ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'cross_pod_deps',      true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'cross_pod_deps',      true)  ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'owner_demand',        true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'owner_demand',        true)  ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'deadline_gap',        true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'deadline_gap',        true)  ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'resource_allocation', true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'resource_allocation', true)  ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'pod_splits',          true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'pod_splits',          true)  ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'pod_project_matrix',  true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'pod_project_matrix',  true)  ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'project_pod_matrix',  true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'project_pod_matrix',  true)  ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'project_gantt',       true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'project_gantt',       true)  ON CONFLICT (role, page_key) DO NOTHING;

-- Budget & Resource ROI: READ_ONLY restricted by default (sensitive financial data)
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'budget',              true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'budget',              false) ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'resource_roi',        true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'resource_roi',        false) ON CONFLICT (role, page_key) DO NOTHING;
