-- V65: Add page permissions for Budget & CapEx (consolidated) and Project Signals (consolidated)
-- Budget & CapEx replaces the standalone budget page + jira_capex page
-- Project Signals replaces the standalone owner_demand, deadline_gap, pod_splits pages

INSERT INTO page_permission (role, page_key, allowed)
VALUES
  ('READ_WRITE', 'budget_capex',     true),
  ('READ_ONLY',  'budget_capex',     true),
  ('READ_WRITE', 'project_signals',  true),
  ('READ_ONLY',  'project_signals',  true)
ON CONFLICT (role, page_key) DO NOTHING;
